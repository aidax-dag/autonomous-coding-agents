# Common Field Mapping (GitHub <-> Jira)

| Common Field | GitHub | Jira | Required |
|---|---|---|---|
| Ticket ID | Issue body (`Ticket ID`) | Custom field (`Ticket ID`) | Yes |
| Epic ID | Label `epic:E01` or body | Epic Link/Label | Yes |
| Capability ID | Label `capability:C01` | Label `capability:C01` | Yes |
| Feature ID | Label `feature:F0101` | Label `feature:F0101` | Yes |
| Release Target | Milestone/Label `release:v1` | Fix Version | Yes |
| Provider | Label `provider:github` | Label `provider:jira` | Yes |
| External Project | ProjectV2 item | Project Key | Yes |
| External Issue ID | Issue Number | Issue Key | Yes |
| Issue Type | Label `type:task` | Issue Type (Task/Story/...) | Yes |
| Priority | Label `priority:P0` | Priority field | Yes |
| Assignee | Assignees | Assignee | No |
| Reporter | Issue author/body | Reporter | No |
| Sprint | Project iteration field | Sprint field | No |
| Due Date | Milestone due/body | Due date | No |
| Status | ProjectV2 status or label | Workflow status | Yes |
| Dependency Tickets | Body checklist/linked issues | Issue links (`blocks`) | Yes |
| Artifact Links | Body links | Description/attachments | Yes |
| Verification Links | Body links | Description/attachments | Yes |

## Label Convention (공통)

- `epic:E01`
- `capability:C01`
- `feature:F0101`
- `ticket:T0101`
- `release:v1`
- `area:mal`
- `priority:P0`
- `provider:common`

## Status Convention (공통)

- `created`
- `in_progress`
- `pending`
- `reviewing`
- `completed`
- `cancelled`
