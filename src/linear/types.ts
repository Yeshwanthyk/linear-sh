// Types for Linear API interactions

export interface IssueSummary {
	readonly id: string;
	readonly identifier: string;
	readonly title: string;
	readonly url: string;
	readonly description: string | null;
	readonly branchName: string | null;
	readonly stateId: string | null;
	readonly assigneeId: string | null;
	readonly teamId: string | null;
	readonly projectId: string | null;
	readonly labelIds: string[];
	readonly priorityLabel: string | null;
	readonly createdAt: string | null;
	readonly updatedAt: string | null;
}

export interface IssueLabelSummary {
	readonly id: string;
	readonly name: string;
	readonly color: string | null;
}

export interface IssueDetails extends IssueSummary {
	readonly stateName: string | null;
	readonly assigneeName: string | null;
	readonly teamName: string | null;
	readonly labels: IssueLabelSummary[];
}

export interface IssueCreateInput {
	readonly teamId: string;
	readonly title: string;
	readonly description?: string;
	readonly assigneeId?: string;
	readonly labelIds?: string[];
	readonly projectId?: string;
}

export interface IssueUpdateInput {
	readonly title?: string;
	readonly description?: string;
	readonly assigneeId?: string;
	readonly stateId?: string;
	readonly labelIds?: string[];
}

export interface CommentInput {
	readonly issueId: string;
	readonly body: string;
}

export interface IssueListOptions {
	readonly teamId?: string;
	readonly stateId?: string;
	readonly assigneeId?: string;
	readonly projectId?: string;
	readonly limit?: number;
}

export interface WorkflowStateSummary {
	readonly id: string;
	readonly name: string;
	readonly teamId: string | null;
}

export interface UserSummary {
	readonly id: string;
	readonly name: string;
	readonly email: string | null;
}
