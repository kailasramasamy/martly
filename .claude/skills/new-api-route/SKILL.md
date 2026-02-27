---
name: new-api-route
description: Scaffold a new Fastify API route for the Martly API following existing patterns (auth, org-scoping, Zod validation)
argument-hint: <route-name>
---

Create a new API route module for the Martly API server.

**Route name:** $ARGUMENTS

## Steps

1. **Read existing route for reference** — Read `/Users/vaidehi/Projects/martly/apps/api/src/routes/products/index.ts` to follow the established pattern.

2. **Create the route file** at `apps/api/src/routes/<route-name>/index.ts` following these conventions:
   - Export a default async function `(app: FastifyInstance)`
   - Use `app.get`, `app.post`, `app.put`, `app.patch`, `app.delete`
   - Add `{ preHandler: [app.authenticate] }` for protected routes
   - Use `getOrgUser(request)` from `../../middleware/org-scope` for org-scoped data
   - Validate request body/params with Zod schemas from `@martly/shared`
   - Use `app.prisma` for database queries
   - Always scope queries by `organizationId` for multi-tenant safety
   - Return proper HTTP status codes (200, 201, 400, 404)

3. **Add Zod schemas** — If needed, add validation schemas to `packages/shared/src/schemas/index.ts`.

4. **Register the route** in `apps/api/src/app.ts`:
   - Import the route module
   - Register with `app.register(routeModule, { prefix: '/api/v1/<route-name>' })`

5. **Run `pnpm db:generate`** if new Prisma models are involved.

## Pattern Reference

```typescript
import { FastifyInstance } from 'fastify';
import { getOrgUser } from '../../middleware/org-scope';

export default async function (app: FastifyInstance) {
  // GET list (org-scoped)
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    const items = await app.prisma.model.findMany({
      where: { organizationId },
    });
    return items;
  });

  // POST create
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const { organizationId } = getOrgUser(request);
    const data = SomeSchema.parse(request.body);
    const item = await app.prisma.model.create({
      data: { ...data, organizationId },
    });
    return reply.status(201).send(item);
  });
}
```
