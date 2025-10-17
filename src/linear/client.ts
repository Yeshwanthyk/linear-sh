import { LinearClient } from "@linear/sdk";

import type { LinearConfig } from "../config";
import { LinearApiError } from "../errors";
import { MetadataCache } from "./cache";

const ISSUE_IDENTIFIER_REGEX = /^[A-Za-z]+-\d+$/i;
const DEFAULT_MAX_LIST_ITEMS = 50;

export interface LinearServiceOptions {
  readonly config: LinearConfig;
  readonly cache?: MetadataCache | null;
  readonly client?: LinearClientLike;
  readonly maxListItems?: number;
}

export interface IssueSummary {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly url: string;
  readonly description?: string | null;
  readonly branchName?: string | null;
  readonly stateId?: string | null;
  readonly assigneeId?: string | null;
  readonly teamId?: string | null;
  readonly labelIds: string[];
  readonly priorityLabel?: string | null;
  readonly updatedAt?: string | null;
  readonly createdAt?: string | null;
}

export interface IssueDetails extends IssueSummary {
  readonly stateName?: string | null;
  readonly assigneeName?: string | null;
  readonly teamName?: string | null;
  readonly labels: IssueLabelSummary[];
}

export interface IssueLabelSummary {
  readonly id: string;
  readonly name: string;
  readonly color?: string | null;
}

export interface IssueListOptions {
  readonly teamId?: string;
  readonly stateId?: string;
  readonly limit?: number;
  readonly assigneeId?: string;
}

export interface IssueUpdateInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly assigneeId?: string | null;
  readonly stateId?: string;
  readonly labelIds?: string[];
}

export interface IssueCreateInput {
  readonly teamId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly assigneeId?: string;
  readonly labelIds?: string[];
}

export interface CommentInput {
  readonly issueId: string;
  readonly body: string;
}

export interface WorkflowStateSummary {
  readonly id: string;
  readonly name: string;
  readonly teamId?: string | null;
}

export interface UserSummary {
  readonly id: string;
  readonly name: string;
  readonly email?: string | null;
}

interface LinearClientLike {
  issue(id: string): PromiseLike<LinearIssueEntity> | undefined;
  searchIssues(term: string, variables?: Record<string, unknown>): PromiseLike<IssueSearchPayloadEntity>;
  issues(variables: Record<string, unknown>): PromiseLike<IssueConnectionEntity>;
  issueCreate(variables: { input: Record<string, unknown> }): PromiseLike<IssueMutationPayload>;
  issueUpdate(variables: { id: string; input: Record<string, unknown> }): PromiseLike<IssueMutationPayload>;
  commentCreate(variables: { input: Record<string, unknown> }): PromiseLike<CommentMutationPayload>;
  workflowStates(variables: Record<string, unknown>): PromiseLike<WorkflowStateConnectionEntity>;
  users(variables: Record<string, unknown>): PromiseLike<UserConnectionEntity>;
}

interface LinearIssueEntity {
  id: string;
  identifier: string;
  title: string;
  url: string;
  description?: string | null;
  branchName?: string | null;
  stateId?: string | null;
  assigneeId?: string | null;
  teamId?: string | null;
  labelIds: string[];
  priorityLabel?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  labels?: (variables?: Record<string, unknown>) => Promise<IssueLabelConnectionEntity>;
  team?: (variables?: Record<string, unknown>) => Promise<{ id: string; name: string; key?: string | null } | null>;
  assignee?: (variables?: Record<string, unknown>) => Promise<{ id: string; name: string; email?: string | null } | null>;
}

interface IssueConnectionEntity {
  nodes?: LinearIssueEntity[];
}

interface IssueSearchPayloadEntity {
  nodes?: LinearIssueEntity[];
}

interface IssueMutationPayload {
  success: boolean;
  issue?: LinearIssueEntity | null;
}

interface CommentMutationPayload {
  success: boolean;
  comment?: { id: string } | null;
}

interface WorkflowStateConnectionEntity {
  nodes?: Array<{ id: string; name: string; team?: { id: string } | null }>;
}

interface UserConnectionEntity {
  nodes?: Array<{ id: string; name: string; email?: string | null }>;
}

interface IssueLabelConnectionEntity {
  nodes?: Array<{ id: string; name: string; color?: string | null }>;
}

export class LinearService {
  private readonly client: LinearClientLike;
  private readonly cache: MetadataCache | undefined;
  private readonly maxListItems: number;

  constructor(options: LinearServiceOptions) {
    this.cache = options.cache === null ? undefined : options.cache ?? new MetadataCache();
    this.maxListItems = options.maxListItems ?? DEFAULT_MAX_LIST_ITEMS;

    if (options.client) {
      this.client = options.client;
    } else {
      const baseClient = new LinearClient({
        apiKey: options.config.apiKey,
        apiUrl: options.config.apiHost,
      });
      this.client = baseClient as unknown as LinearClientLike;
    }
  }

  async getIssue(issueRef: string): Promise<IssueSummary> {
    const issue = await this.fetchIssue(issueRef);
    return this.mapIssue(issue);
  }

  async getIssueDetails(issueRef: string): Promise<IssueDetails> {
    const issue = await this.fetchIssue(issueRef);
    const summary = this.mapIssue(issue);

    const [states, users, labels, team] = await Promise.all([
      summary.teamId ? this.getWorkflowStates(summary.teamId) : Promise.resolve([]),
      this.getUsers(),
      this.fetchLabelSummaries(issue),
      this.fetchTeam(issue),
    ]);

    return {
      ...summary,
      stateName: summary.stateId
        ? states.find((state) => state.id === summary.stateId)?.name ?? null
        : null,
      assigneeName: summary.assigneeId
        ? users.find((user) => user.id === summary.assigneeId)?.name ?? null
        : null,
      teamName: team?.name ?? null,
      labels,
    };
  }

  async listIssues(options: IssueListOptions = {}): Promise<IssueSummary[]> {
    try {
      const filter = this.buildIssueFilter(options);
      const response = await this.client.issues({
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        first: options.limit ?? this.maxListItems,
        orderBy: "updatedAt",
      });

      const nodes = response?.nodes ?? [];
      return nodes.map((node) => this.mapIssue(node));
    } catch (error) {
      throw this.toLinearApiError(error, "Failed to list issues");
    }
  }

  async createIssue(input: IssueCreateInput): Promise<IssueSummary> {
    try {
      const response = await this.client.issueCreate({
        input: {
          teamId: input.teamId,
          title: input.title,
          description: input.description ?? null,
          assigneeId: input.assigneeId,
          labelIds: input.labelIds,
        },
      });

      if (!response.success || !response.issue) {
        throw new LinearApiError("Linear API did not return created issue");
      }

      return this.mapIssue(response.issue);
    } catch (error) {
      throw this.toLinearApiError(error, "Failed to create issue");
    }
  }

  async updateIssue(issueId: string, input: IssueUpdateInput): Promise<IssueSummary> {
    try {
      const response = await this.client.issueUpdate({
        id: issueId,
        input: {
          title: input.title,
          description: input.description ?? undefined,
          assigneeId: input.assigneeId,
          stateId: input.stateId,
          labelIds: input.labelIds,
        },
      });

      if (!response.success || !response.issue) {
        throw new LinearApiError(`Linear API did not return updated issue ${issueId}`);
      }

      return this.mapIssue(response.issue);
    } catch (error) {
      throw this.toLinearApiError(error, `Failed to update issue ${issueId}`);
    }
  }

  async transitionIssue(issueId: string, workflowStateId: string): Promise<IssueSummary> {
    return this.updateIssue(issueId, { stateId: workflowStateId });
  }

  async createComment(input: CommentInput): Promise<string> {
    try {
      const response = await this.client.commentCreate({
        input: {
          issueId: input.issueId,
          body: input.body,
        },
      });

      if (!response.success || !response.comment) {
        throw new LinearApiError("Failed to create comment");
      }

      return response.comment.id;
    } catch (error) {
      throw this.toLinearApiError(error, `Failed to comment on issue ${input.issueId}`);
    }
  }

  async getWorkflowStates(teamId?: string, forceRefresh = false): Promise<WorkflowStateSummary[]> {
    const cacheKey = `workflowStates:${teamId ?? "all"}`;
    if (!forceRefresh) {
      const cached = await this.cache?.get<WorkflowStateSummary[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.client.workflowStates({
        first: this.maxListItems,
        filter: teamId ? { team: { id: { eq: teamId } } } : undefined,
      });
      const nodes = response?.nodes ?? [];
      const normalised = nodes.map((node) => ({
        id: node.id,
        name: node.name,
        teamId: node.team?.id ?? null,
      }));

      await this.cache?.set(cacheKey, normalised);
      return normalised;
    } catch (error) {
      throw this.toLinearApiError(error, "Failed to load workflow states");
    }
  }

  async getUsers(teamId?: string, forceRefresh = false): Promise<UserSummary[]> {
    const cacheKey = `users:${teamId ?? "all"}`;
    if (!forceRefresh) {
      const cached = await this.cache?.get<UserSummary[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await this.client.users({
        first: this.maxListItems,
        filter: teamId ? { teams: { some: { id: { eq: teamId } } } } : undefined,
      });
      const nodes = response?.nodes ?? [];
      const normalised = nodes.map((node) => ({
        id: node.id,
        name: node.name,
        email: node.email ?? null,
      }));

      await this.cache?.set(cacheKey, normalised);
      return normalised;
    } catch (error) {
      throw this.toLinearApiError(error, "Failed to load users");
    }
  }

  private async fetchIssue(issueRef: string): Promise<LinearIssueEntity> {
    const trimmed = issueRef.trim();

    const possibleId = this.isLikelyLinearId(trimmed);
    if (possibleId) {
      const byId = this.client.issue(trimmed);
      if (byId) {
        const issueById = await byId;
        if (issueById) {
          return issueById;
        }
      }
    }

    try {
      const searchResponse = await this.client.searchIssues(trimmed, {
        first: 1,
      });
      const match = searchResponse?.nodes?.[0];
      if (match) {
        return match;
      }
    } catch (error) {
      throw this.toLinearApiError(error, `Failed to search for issue ${trimmed}`);
    }

    throw new LinearApiError(`Issue ${trimmed} not found`, 404);
  }

  private mapIssue(issue: LinearIssueEntity): IssueSummary {
    return {
      id: issue.id,
      identifier: issue.identifier,
      title: issue.title,
      url: issue.url,
      description: issue.description ?? null,
      branchName: issue.branchName ?? null,
      stateId: issue.stateId ?? null,
      assigneeId: issue.assigneeId ?? null,
      teamId: issue.teamId ?? null,
      labelIds: issue.labelIds ?? [],
      priorityLabel: issue.priorityLabel ?? null,
      createdAt: issue.createdAt?.toISOString() ?? null,
      updatedAt: issue.updatedAt?.toISOString() ?? null,
    };
  }

  private async fetchLabelSummaries(issue: LinearIssueEntity): Promise<IssueLabelSummary[]> {
    if (typeof issue.labels !== "function") {
      return [];
    }

    try {
      const connection = await issue.labels({ first: this.maxListItems });
      const nodes = connection?.nodes ?? [];
      return nodes.map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color ?? null,
      }));
    } catch (error) {
      throw this.toLinearApiError(error, "Failed to load labels for issue");
    }
  }

  private async fetchTeam(issue: LinearIssueEntity): Promise<{ id: string; name: string } | null> {
    if (typeof issue.team !== "function") {
      return null;
    }

    try {
      const team = await issue.team();
      if (!team) {
        return null;
      }
      return {
        id: team.id,
        name: team.name,
      };
    } catch (error) {
      throw this.toLinearApiError(error, "Failed to load team for issue");
    }
  }

  private buildIssueFilter(options: IssueListOptions): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (options.teamId) {
      filter.team = { id: { eq: options.teamId } };
    }
    if (options.stateId) {
      filter.state = { id: { eq: options.stateId } };
    }
    if (options.assigneeId) {
      filter.assignee = { id: { eq: options.assigneeId } };
    }
    return filter;
  }

  private isLikelyLinearId(value: string): boolean {
    if (ISSUE_IDENTIFIER_REGEX.test(value)) {
      return false;
    }
    return value.includes("-");
  }

  private toLinearApiError(error: unknown, fallback: string): LinearApiError {
    if (error instanceof LinearApiError) {
      return error;
    }

    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const status = this.extractStatus(record);
      const message = this.extractMessage(record, fallback);
      return new LinearApiError(message, status);
    }

    return new LinearApiError(`${fallback}: ${String(error)}`);
  }

  private extractStatus(error: Record<string, unknown>): number | undefined {
    if (typeof error.status === "number") {
      return error.status;
    }

    const response = error.response as { status?: number } | undefined;
    if (response && typeof response.status === "number") {
      return response.status;
    }

    return undefined;
  }

  private extractMessage(error: Record<string, unknown>, fallback: string): string {
    if (typeof error.message === "string" && error.message.length > 0) {
      return error.message;
    }

    const errors = error.errors as Array<{ message?: string }> | undefined;
    const firstMessage = errors?.find((entry) => entry.message)?.message;
    if (firstMessage) {
      return `${fallback}: ${firstMessage}`;
    }

    return fallback;
  }
}
