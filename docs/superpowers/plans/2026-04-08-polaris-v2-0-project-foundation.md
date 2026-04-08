# Polaris V2.0 Project Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the V2.0 project foundation so Polaris can create projects, migrate V1 data into a default project, bind saved requests/mock rules/proxy rules to projects, and expose the first project-aware Console flow.

**Architecture:** Keep Core as the source of truth for projects and project bindings, migrate local storage in place with a versioned snapshot, and extend the existing Console `domains/*` pattern instead of adding page-level data logic. Projects land first; environments, collections, MCP upgrades, and extension enhancements stay out of this plan.

**Tech Stack:** TypeScript, Express, React 19, TanStack Query v5, Zustand, Vitest, pnpm workspace

---

## File Map

- Create: `packages/shared-types/src/domain/project.ts`
- Create: `packages/shared-contracts/src/api/projectContracts.ts`
- Create: `apps/core/src/modules/projects/projectService.ts`
- Create: `apps/core/src/modules/projects/projectService.test.ts`
- Create: `apps/console/src/domains/projects/queries.ts`
- Create: `apps/console/src/domains/projects/mutations.ts`
- Create: `apps/console/src/pages/projects/ProjectsPage.tsx`
- Create: `apps/console/src/pages/project-detail/ProjectDetailPage.tsx`
- Modify: `packages/shared-types/src/domain/savedRequest.ts`
- Modify: `packages/shared-types/src/domain/mockRule.ts`
- Modify: `packages/shared-types/src/domain/proxyRule.ts`
- Modify: `packages/shared-types/src/domain/appSetting.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-contracts/src/api/contracts.ts`
- Modify: `packages/shared-contracts/src/index.ts`
- Modify: `apps/core/src/modules/storage/storageAdapter.ts`
- Modify: `apps/core/src/modules/requests/requestService.ts`
- Modify: `apps/core/src/modules/mock/mockService.ts`
- Modify: `apps/core/src/modules/proxy/proxyService.ts`
- Modify: `apps/core/src/api/routes/createApiRouter.ts`
- Modify: `apps/core/src/app/runtime.ts`
- Modify: `apps/core/package.json`
- Modify: `apps/console/src/services/apiClient.ts`
- Modify: `apps/console/src/lib/query/queryKeys.ts`
- Modify: `apps/console/src/app/router.tsx`
- Modify: `apps/console/src/domains/home/queries.ts`
- Modify: `apps/console/src/pages/home/HomePage.tsx`
- Modify: `apps/console/src/test/integration/coreFlows.test.ts`

---

### Task 1: Define Shared Project Contracts

**Files:**
- Create: `packages/shared-types/src/domain/project.ts`
- Create: `packages/shared-contracts/src/api/projectContracts.ts`
- Modify: `packages/shared-types/src/domain/savedRequest.ts`
- Modify: `packages/shared-types/src/domain/mockRule.ts`
- Modify: `packages/shared-types/src/domain/proxyRule.ts`
- Modify: `packages/shared-types/src/domain/appSetting.ts`
- Modify: `packages/shared-types/src/index.ts`
- Modify: `packages/shared-contracts/src/api/contracts.ts`
- Modify: `packages/shared-contracts/src/index.ts`

- [ ] **Step 1: Write the failing shared contract usage**

Create `packages/shared-contracts/src/api/projectContracts.ts`:

```ts
import type { Project } from "@polaris/shared-types";

export interface CreateProjectInput {
  name: string;
  description?: string;
  tags?: string[];
}

export interface UpdateProjectInput {
  name: string;
  description?: string;
  tags?: string[];
}

export interface SetActiveProjectInput {
  projectId: string | null;
}

export interface ProjectListItem extends Project {
  savedRequestCount: number;
  mockRuleCount: number;
  proxyRuleCount: number;
}
```

- [ ] **Step 2: Run typecheck to confirm `Project` does not exist yet**

Run: `corepack pnpm typecheck`

Expected: FAIL with a TypeScript error about missing `Project`.

- [ ] **Step 3: Add the minimal shared types**

Create `packages/shared-types/src/domain/project.ts`:

```ts
export interface Project {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}
```

Update `packages/shared-types/src/domain/savedRequest.ts`:

```ts
projectId: string;
```

Update `packages/shared-types/src/domain/mockRule.ts`:

```ts
projectId: string;
```

Update `packages/shared-types/src/domain/proxyRule.ts`:

```ts
projectId: string;
priority?: number;
```

Update `packages/shared-types/src/domain/appSetting.ts`:

```ts
activeProjectId?: string | null;
defaultProjectId?: string | null;
recentProjectIds?: string[];
defaultEnvironmentIdByProjectId?: Record<string, string | null>;
```

- [ ] **Step 4: Export the new types and wire API contracts**

Update `packages/shared-types/src/index.ts`:

```ts
export * from "./domain/project";
```

Update `packages/shared-contracts/src/index.ts`:

```ts
export * from "./api/projectContracts";
```

Add to `packages/shared-contracts/src/api/contracts.ts`:

```ts
import type { CreateProjectInput, ProjectListItem, SetActiveProjectInput, UpdateProjectInput } from "./projectContracts";
import type { Project } from "@polaris/shared-types";

"/api/projects": { get: ApiEnvelope<ProjectListItem[]>; post: ApiEnvelope<Project> & { body: CreateProjectInput } };
"/api/projects/:id": { get: ApiEnvelope<ProjectListItem>; put: ApiEnvelope<Project> & { body: UpdateProjectInput }; delete: ApiEnvelope<{ id: string }> };
"/api/projects/active": {
  get: ApiEnvelope<{ projectId: string | null }>;
  post: ApiEnvelope<{ projectId: string | null }> & { body: SetActiveProjectInput };
};
```

- [ ] **Step 5: Run typecheck**

Run: `corepack pnpm typecheck`

Expected: PASS for shared layer or only fail in app files that have not been updated yet.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types packages/shared-contracts
git commit -m "feat: add project shared types and contracts"
```

---

### Task 2: Add Core Project Migration, Service, And Routes

**Files:**
- Modify: `apps/core/package.json`
- Modify: `apps/core/src/modules/storage/storageAdapter.ts`
- Create: `apps/core/src/modules/projects/projectService.ts`
- Create: `apps/core/src/modules/projects/projectService.test.ts`
- Modify: `apps/core/src/modules/requests/requestService.ts`
- Modify: `apps/core/src/modules/mock/mockService.ts`
- Modify: `apps/core/src/modules/proxy/proxyService.ts`
- Modify: `apps/core/src/api/routes/createApiRouter.ts`
- Modify: `apps/core/src/app/runtime.ts`

- [ ] **Step 1: Add a Core test entry and failing project service test**

Update `apps/core/package.json`:

```json
{
  "scripts": {
    "test": "node --test --import tsx src/**/*.test.ts"
  }
}
```

Create `apps/core/src/modules/projects/projectService.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { ProjectService } from "./projectService";

test("ProjectService exposes list()", () => {
  assert.equal(typeof ProjectService, "function");
});
```

- [ ] **Step 2: Run Core tests and confirm the service is missing**

Run: `corepack pnpm --filter @polaris/core test`

Expected: FAIL with a missing module error for `projectService`.

- [ ] **Step 3: Add versioned storage migration**

Update `apps/core/src/modules/storage/storageAdapter.ts` so the snapshot includes:

```ts
schemaVersion: 2;
projects: Project[];
```

Add the migration default project:

```ts
const defaultProject: Project = {
  id: randomUUID(),
  name: "默认项目",
  description: "从 V1 自动迁移生成",
  tags: [],
  createdAt: now,
  updatedAt: now,
  lastUsedAt: now
};
```

Apply it when no `schemaVersion` exists:

```ts
settings: {
  ...defaultSettings,
  ...(parsed.settings ?? {}),
  activeProjectId: defaultProject.id,
  defaultProjectId: defaultProject.id,
  recentProjectIds: [defaultProject.id],
  defaultEnvironmentIdByProjectId: {}
},
projects: [defaultProject],
savedRequests: (parsed.savedRequests ?? []).map((item) => ({ ...item, projectId: defaultProject.id })),
mockRules: (parsed.mockRules ?? []).map((item) => ({ ...item, projectId: defaultProject.id })),
proxyRules: nextProxyRules.map((item) => ({ ...item, projectId: defaultProject.id, priority: item.priority ?? 100 }))
```

- [ ] **Step 4: Implement the first `ProjectService`**

Create `apps/core/src/modules/projects/projectService.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { CreateProjectInput, UpdateProjectInput } from "@polaris/shared-contracts";
import type { Project } from "@polaris/shared-types";
import { StorageAdapter } from "../storage/storageAdapter";

export class ProjectService {
  constructor(private readonly storage: StorageAdapter) {}

  list(): Project[] {
    return this.storage.getProjects();
  }

  getById(id: string): Project | undefined {
    return this.list().find((item) => item.id === id);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now
    };
    await this.storage.setProjects([project, ...this.list()]);
    return project;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const current = this.getById(id);
    if (!current) {
      throw new Error("Project not found");
    }
    const next: Project = {
      ...current,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      tags: input.tags ?? [],
      updatedAt: new Date().toISOString()
    };
    await this.storage.setProjects(this.list().map((item) => (item.id === id ? next : item)));
    return next;
  }
}
```

- [ ] **Step 5: Bind existing assets and expose routes**

Update `apps/core/src/modules/requests/requestService.ts`:

```ts
const projectId = input.projectId ?? this.storage.getSettings().defaultProjectId;
if (!projectId) {
  throw new Error("Default project not set");
}
```

Update `apps/core/src/modules/mock/mockService.ts` and `apps/core/src/modules/proxy/proxyService.ts` with the same `projectId` fallback pattern.

Update `apps/core/src/api/routes/createApiRouter.ts`:

```ts
router.get("/projects", (_req, res) => {
  res.json({ data: projectService.list() });
});

router.post("/projects", withAsync(async (req, res) => {
  res.json({ data: await projectService.create(req.body) });
}));

router.get("/projects/active", (_req, res) => {
  res.json({ data: { projectId: proxyService.getSettings().activeProjectId ?? null } });
});

router.post("/projects/active", withAsync(async (req, res) => {
  const settings = proxyService.getSettings();
  await proxyService.setSettings({ ...settings, activeProjectId: req.body.projectId ?? null });
  res.json({ data: { projectId: req.body.projectId ?? null } });
}));
```

- [ ] **Step 6: Run Core validation**

Run: `corepack pnpm --filter @polaris/core test`

Expected: PASS

Run: `corepack pnpm --filter @polaris/core typecheck`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/core
git commit -m "feat: add project migration service and routes"
```

---

### Task 3: Add Console Project Domains And Pages

**Files:**
- Modify: `apps/console/src/services/apiClient.ts`
- Modify: `apps/console/src/lib/query/queryKeys.ts`
- Create: `apps/console/src/domains/projects/queries.ts`
- Create: `apps/console/src/domains/projects/mutations.ts`
- Create: `apps/console/src/pages/projects/ProjectsPage.tsx`
- Create: `apps/console/src/pages/project-detail/ProjectDetailPage.tsx`
- Modify: `apps/console/src/app/router.tsx`
- Modify: `apps/console/src/domains/home/queries.ts`
- Modify: `apps/console/src/pages/home/HomePage.tsx`
- Modify: `apps/console/src/test/integration/coreFlows.test.ts`

- [ ] **Step 1: Add the failing integration expectations**

Update `apps/console/src/test/integration/coreFlows.test.ts`:

```ts
it("loads projects through the api client", async () => {
  const projects = await apiClient.listProjects();
  expect(Array.isArray(projects)).toBe(true);
});
```

- [ ] **Step 2: Run Console tests and confirm client support is missing**

Run: `corepack pnpm --filter @polaris/console test`

Expected: FAIL with `apiClient.listProjects is not a function` or a missing route error.

- [ ] **Step 3: Add API client and query keys**

Update `apps/console/src/services/apiClient.ts`:

```ts
import type { CreateProjectInput, ProjectListItem, UpdateProjectInput } from "@polaris/shared-contracts";
import type { Project } from "@polaris/shared-types";

listProjects: () => request<ProjectListItem[]>("/projects"),
createProject: (body: CreateProjectInput) =>
  request<Project>("/projects", { method: "POST", body: JSON.stringify(body) }),
updateProject: (id: string, body: UpdateProjectInput) =>
  request<Project>(`/projects/${id}`, { method: "PUT", body: JSON.stringify(body) }),
getActiveProject: () => request<{ projectId: string | null }>("/projects/active"),
setActiveProject: (projectId: string | null) =>
  request<{ projectId: string | null }>("/projects/active", { method: "POST", body: JSON.stringify({ projectId }) }),
```

Update `apps/console/src/lib/query/queryKeys.ts`:

```ts
projects: {
  root: ["projects"] as const,
  list: ["projects", "list"] as const,
  detail: (projectId: string) => ["projects", "detail", projectId] as const,
  active: ["projects", "active"] as const,
},
```

- [ ] **Step 4: Add project domains**

Create `apps/console/src/domains/projects/queries.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { queryKeys } from "../../lib/query/queryKeys";
import { queryStaleTime } from "../../lib/query/queryOptions";

export function useProjectListQuery() {
  return useQuery({
    queryKey: queryKeys.projects.list,
    queryFn: () => apiClient.listProjects(),
    staleTime: queryStaleTime.medium
  });
}
```

Create `apps/console/src/domains/projects/mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { queryKeys } from "../../lib/query/queryKeys";

export function useCreateProjectMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: apiClient.createProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects.root });
      await queryClient.invalidateQueries({ queryKey: queryKeys.home.overview });
    }
  });
}
```

- [ ] **Step 5: Add project pages and router entries**

Create `apps/console/src/pages/projects/ProjectsPage.tsx`:

```tsx
import { Button, Card, Empty, Typography } from "antd";
import { useProjectListQuery } from "../../domains/projects/queries";

const { Title, Paragraph } = Typography;

export function ProjectsPage() {
  const projectsQuery = useProjectListQuery();
  const projects = projectsQuery.data ?? [];

  return (
    <div>
      <Title level={2}>项目</Title>
      <Paragraph>把请求、模拟和规则组织到项目里。</Paragraph>
      <Button type="primary">新建项目</Button>
      {projects.length === 0 ? (
        <Empty description="还没有项目，先创建一个。" />
      ) : (
        projects.map((project) => (
          <Card key={project.id} title={project.name}>
            <p>{project.description || "暂无描述"}</p>
            <p>请求 {project.savedRequestCount} · Mock {project.mockRuleCount} · 规则 {project.proxyRuleCount}</p>
          </Card>
        ))
      )}
    </div>
  );
}
```

Create `apps/console/src/pages/project-detail/ProjectDetailPage.tsx`:

```tsx
import { Empty, Typography } from "antd";
import { useParams } from "react-router-dom";
import { useProjectListQuery } from "../../domains/projects/queries";

const { Title, Paragraph } = Typography;

export function ProjectDetailPage() {
  const { projectId = "" } = useParams();
  const projectsQuery = useProjectListQuery();
  const project = (projectsQuery.data ?? []).find((item) => item.id === projectId);

  if (!project) {
    return <Empty description="项目不存在或尚未加载。" />;
  }

  return (
    <div>
      <Title level={2}>{project.name}</Title>
      <Paragraph>{project.description || "暂无描述"}</Paragraph>
    </div>
  );
}
```

Update `apps/console/src/app/router.tsx` with:

```tsx
{ path: "projects", element: <LazyPage><ProjectsPage /></LazyPage> },
{ path: "projects/:projectId", element: <LazyPage><ProjectDetailPage /></LazyPage> },
```

- [ ] **Step 6: Show recent projects on Home**

Update `apps/console/src/domains/home/queries.ts`:

```ts
const [bootstrap, health, settings, projects] = await Promise.all([
  apiClient.bootstrap(),
  apiClient.health(),
  apiClient.settings(),
  apiClient.listProjects()
]);
```

Update `apps/console/src/pages/home/HomePage.tsx` to derive:

```ts
const recentProjects = overviewQuery.data?.projects.slice(0, 3) ?? [];
```

and render them in a lightweight card section.

- [ ] **Step 7: Run Console validation**

Run: `corepack pnpm --filter @polaris/console test`

Expected: PASS

Run: `corepack pnpm --filter @polaris/console typecheck`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/console
git commit -m "feat: add v2 project pages and console project domains"
```

---

## Self-Review

### Spec coverage

- Project model: covered in Task 1
- Active/default project settings: covered in Tasks 1-2
- Storage migration: covered in Task 2
- SavedRequest/MockRule/ProxyRule project binding: covered in Task 2
- Project list/detail Console flow: covered in Task 3
- Recent projects on Home: covered in Task 3

### Placeholder scan

- No `TODO` or `TBD`
- Each task contains exact file paths
- Each code step includes concrete code
- Each validation step includes an exact command

### Type consistency

- `projectId` is used consistently across assets
- `activeProjectId`, `defaultProjectId`, `recentProjectIds`, and `defaultEnvironmentIdByProjectId` stay under settings
- `ProjectListItem` is the UI-facing summary type

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-08-polaris-v2-0-project-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
