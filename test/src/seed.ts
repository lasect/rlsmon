import { faker } from "@faker-js/faker";
import postgres from "postgres";

const DATABASE_URL =
	process.env.DATABASE_URL ||
	"postgres://rlsmon:test@localhost:5433/rlsmon_test";

// Seeding configuration
const CONFIG = {
	minimal: {
		tenants: 2,
		usersPerTenant: { min: 3, max: 5 },
		projectsPerTenant: { min: 2, max: 3 },
		tasksPerProject: { min: 3, max: 8 },
		documentsPerTenant: { min: 5, max: 10 },
	},
	full: {
		tenants: 5,
		usersPerTenant: { min: 8, max: 15 },
		projectsPerTenant: { min: 5, max: 12 },
		tasksPerProject: { min: 10, max: 30 },
		documentsPerTenant: { min: 20, max: 50 },
	},
	enterprise: {
		tenants: 10,
		usersPerTenant: { min: 20, max: 50 },
		projectsPerTenant: { min: 15, max: 40 },
		tasksPerProject: { min: 30, max: 100 },
		documentsPerTenant: { min: 100, max: 300 },
	},
};

type Profile = "minimal" | "full" | "enterprise";

function getProfile(): Profile {
	const args = process.argv.slice(2);
	if (args.includes("--minimal")) return "minimal";
	if (args.includes("--enterprise")) return "enterprise";
	if (args.includes("--full")) return "full";
	return "full";
}

interface Tenant {
	id: string;
	name: string;
	slug: string;
}

interface User {
	id: string;
	email: string;
	firstName: string;
	lastName: string;
	tenantId: string;
	role: string;
}

interface Project {
	id: string;
	tenantId: string;
	name: string;
	ownerId: string;
	visibility: string;
	status: string;
}

interface Task {
	id: string;
	tenantId: string;
	projectId: string;
	title: string;
	status: string;
	priority: string;
	assigneeId: string | null;
	reporterId: string;
	isPrivate: boolean;
}

interface Document {
	id: string;
	tenantId: string;
	projectId: string | null;
	title: string;
	ownerId: string;
	visibility: string;
	permissionLevel: string;
	content: string;
}

const companyPrefixes = [
	"Tech",
	"Cloud",
	"Data",
	"Smart",
	"Digital",
	"Cyber",
	"Net",
	"Web",
	"App",
	"Soft",
	"Code",
	"Dev",
	"Sys",
	"Info",
	"Media",
	"Global",
	"Next",
	"Future",
	"Quantum",
	"Nano",
	"Meta",
	"Hyper",
	"Ultra",
	"Super",
	"Micro",
	"Macro",
];

const companySuffixes = [
	"Corp",
	"Inc",
	"Ltd",
	"Solutions",
	"Systems",
	"Labs",
	"Studio",
	"Works",
	"Hub",
	"Network",
	"Platform",
	"Services",
	"Technologies",
	"Innovations",
	"Ventures",
	"Partners",
	"Group",
	"Collective",
	"Alliance",
	"Dynamics",
];

const industries = [
	"Software",
	"E-commerce",
	"Healthcare",
	"Finance",
	"Education",
	"Gaming",
	"AI/ML",
	"Blockchain",
	"IoT",
	"Cybersecurity",
	"Consulting",
	"Marketing",
	"Real Estate",
	"Manufacturing",
	"Logistics",
	"Entertainment",
	"Travel",
];

const departments = [
	"Engineering",
	"Product",
	"Design",
	"Marketing",
	"Sales",
	"Support",
	"HR",
	"Finance",
	"Operations",
	"Legal",
	"Security",
	"Research",
];

const jobTitles: Record<string, string[]> = {
	Engineering: [
		"Senior Engineer",
		"Engineer",
		"Junior Engineer",
		"Tech Lead",
		"Principal Engineer",
	],
	Product: [
		"Product Manager",
		"Product Owner",
		"VP of Product",
		"Associate PM",
	],
	Design: ["Senior Designer", "Designer", "UX Researcher", "Design Lead"],
	Marketing: [
		"Marketing Manager",
		"Content Strategist",
		"Growth Hacker",
		"CMO",
	],
	Sales: ["Sales Rep", "Account Executive", "Sales Manager", "VP of Sales"],
	Support: ["Support Specialist", "Support Lead", "Customer Success Manager"],
	HR: ["HR Manager", "Recruiter", "People Operations", "VP of People"],
	Finance: ["Financial Analyst", "Accountant", "CFO", "Controller"],
	Operations: ["Operations Manager", "Project Manager", "Business Analyst"],
	Legal: ["Legal Counsel", "Paralegal", "General Counsel"],
	Security: ["Security Engineer", "Compliance Officer", "Security Analyst"],
	Research: ["Research Scientist", "Data Scientist", "Research Lead"],
};

const projectTypes = [
	"Website Redesign",
	"Mobile App",
	"API Development",
	"Database Migration",
	"Security Audit",
	"Infrastructure",
	"Marketing Campaign",
	"Product Launch",
	"Customer Portal",
	"Analytics Dashboard",
	"Automation",
	"Integration",
];

const taskPrefixes = [
	"Implement",
	"Design",
	"Review",
	"Fix",
	"Update",
	"Create",
	"Refactor",
	"Test",
	"Deploy",
	"Configure",
	"Optimize",
	"Document",
	"Research",
];

const taskSuffixes = [
	"authentication system",
	"user interface",
	"database schema",
	"API endpoints",
	"documentation",
	"unit tests",
	"deployment pipeline",
	"monitoring alerts",
	"performance issues",
	"security vulnerabilities",
	"mobile responsiveness",
];

const documentTypes = [
	"Technical Specification",
	"Architecture Decision Record",
	"Meeting Notes",
	"Project Plan",
	"User Manual",
	"API Documentation",
	"Security Policy",
	"Onboarding Guide",
	"Quarterly Report",
	"Incident Report",
	"Runbook",
];

function generateCompanyName(): string {
	const prefix = faker.helpers.arrayElement(companyPrefixes);
	const suffix = faker.helpers.arrayElement(companySuffixes);
	const industry = faker.helpers.arrayElement(industries);
	const adjective = faker.word.adjective();
	const capitalizedAdjective =
		adjective.charAt(0).toUpperCase() + adjective.slice(1);
	const patterns = [
		() => `${prefix}${suffix}`,
		() => `${prefix} ${industry} ${suffix}`,
		() => `${capitalizedAdjective} ${industry} ${suffix}`,
		() => `${faker.person.lastName()} ${suffix}`,
		() => `${faker.location.city()} ${suffix}`,
	];
	return faker.helpers.arrayElement(patterns)();
}

function generateProjectName(): string {
	const type = faker.helpers.arrayElement(projectTypes);
	const prefix = faker.helpers.arrayElement([
		"2024",
		"Q4",
		"",
		"New",
		"Improved",
	]);
	const suffix = faker.helpers.arrayElement([
		"v2",
		"2.0",
		"Platform",
		"System",
		"",
	]);
	return [prefix, type, suffix].filter(Boolean).join(" ").trim();
}

function generateTaskTitle(): string {
	const prefix = faker.helpers.arrayElement(taskPrefixes);
	const suffix = faker.helpers.arrayElement(taskSuffixes);
	return `${prefix} ${suffix}`;
}

function generateDocumentTitle(): string {
	const type = faker.helpers.arrayElement(documentTypes);
	const subject = faker.helpers.arrayElement([
		"Project Alpha",
		"Authentication",
		"Database Migration",
		"API v2",
		"Q4 Planning",
		"Security Review",
		"Performance Optimization",
		"User Research",
	]);
	return `${type}: ${subject}`;
}

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);
}

function generateTenantFeatures(): Record<string, boolean> {
	return {
		sso: faker.datatype.boolean(0.4),
		advanced_analytics: faker.datatype.boolean(0.3),
		api_access: faker.datatype.boolean(0.5),
		custom_integrations: faker.datatype.boolean(0.2),
		priority_support: faker.datatype.boolean(0.4),
		audit_logs: faker.datatype.boolean(0.6),
		webhooks: faker.datatype.boolean(0.3),
	};
}

async function seed() {
	const profile = getProfile();
	const config = CONFIG[profile];

	console.log(`🌱 Starting ${profile} seed...`);
	console.log(" Configuration:", JSON.stringify(config, null, 2));

	const sql = postgres(DATABASE_URL);

	try {
		// Verify connection
		await sql`SELECT 1`;
		console.log(" Connected to database");

		// Clear existing data (in reverse order of dependencies)
		console.log(" Clearing existing data...");
		await sql`TRUNCATE TABLE 
      audit_logs, comment_mentions, comments, document_versions, 
      document_permissions, documents, task_dependencies, tasks, 
      project_shares, project_members, projects, user_custom_roles, 
      custom_roles, notifications, approval_steps, approval_workflows,
      api_keys, role_hierarchy, tenant_memberships, users, tenants
      CASCADE`;
		console.log(" Data cleared");

		const tenants: Tenant[] = [];
		const users: User[] = [];
		const projects: Project[] = [];
		const tasks: Task[] = [];
		const documents: Document[] = [];

		// Create tenants
		console.log(`🏢 Creating ${config.tenants} tenants...`);
		for (let i = 0; i < config.tenants; i++) {
			const name = generateCompanyName();
			const slug = generateSlug(name);
			const tier = faker.helpers.arrayElement([
				"free",
				"starter",
				"pro",
				"enterprise",
			]);
			const status = faker.helpers.arrayElement([
				"active",
				"active",
				"active",
				"trialing",
				"past_due",
				"suspended",
			]);

			const result = await sql`
        INSERT INTO tenants (
          name, slug, subscription_tier, subscription_status, 
          features, billing_email, domain, is_active
        ) VALUES (
          ${name}, ${slug}, ${tier}, ${status},
          ${JSON.stringify(generateTenantFeatures())},
          ${faker.internet.email({ firstName: "billing", lastName: slug })},
          ${slug + ".com"},
          ${status !== "suspended"}
        ) RETURNING id
      `;

			const row = result[0];
			if (!row) {
				throw new Error("Failed to create tenant");
			}

			tenants.push({ id: row.id, name, slug });
			console.log(`  ✓ ${name} (${tier})`);
		}

		// Create users and tenant memberships
		console.log(" Creating users and memberships...");
		for (const tenant of tenants) {
			const userCount = faker.number.int(config.usersPerTenant);
			const roles = ["owner", "admin", "manager", "member", "viewer", "guest"];

			// Ensure at least one owner
			const ownerResult = await sql`
        INSERT INTO users (email, first_name, last_name, is_email_verified, is_active)
        VALUES (
          ${faker.internet.email({ firstName: faker.person.firstName(), lastName: tenant.slug })},
          ${faker.person.firstName()},
          ${faker.person.lastName()},
          true,
          true
        ) RETURNING id, first_name, last_name
      `;

			const ownerRow = ownerResult[0];
			if (!ownerRow) {
				throw new Error("Failed to create owner user");
			}

			const ownerId = ownerRow.id;

			await sql`
        INSERT INTO tenant_memberships (
          tenant_id, user_id, role, department, job_title, is_primary, joined_at
        ) VALUES (
          ${tenant.id}, ${ownerId}, 'owner', 'Executive', 'CEO/Founder', 
          true, ${faker.date.past({ years: 2 })}
        )
      `;

			users.push({
				id: ownerId,
				email: faker.internet.email(),
				firstName: ownerRow.first_name,
				lastName: ownerRow.last_name,
				tenantId: tenant.id,
				role: "owner",
			});

			// Create remaining users
			for (let i = 1; i < userCount; i++) {
				const firstName = faker.person.firstName();
				const lastName = faker.person.lastName();
				const email = faker.internet.email({ firstName, lastName });
				const department = faker.helpers.arrayElement(departments);
				const jobTitle = faker.helpers.arrayElement(
					jobTitles[department] || ["Employee"],
				);

				// Weighted role distribution - manual implementation
				const roleWeights = [0.1, 0.15, 0.2, 0.4, 0.1, 0.05];
				const random = Math.random();
				let cumulative = 0;
				let roleIndex = 0;
				for (let i = 0; i < roleWeights.length; i++) {
					cumulative += roleWeights[i];
					if (random <= cumulative) {
						roleIndex = i;
						break;
					}
				}
				const role = roles[roleIndex];

				const userResult = await sql`
          INSERT INTO users (email, first_name, last_name, is_email_verified, is_active)
          VALUES (
            ${email}, ${firstName}, ${lastName},
            ${faker.datatype.boolean(0.9)},
            ${faker.datatype.boolean(0.95)}
          ) RETURNING id
        `;

				const userRow = userResult[0];
				if (!userRow) {
					throw new Error("Failed to create user");
				}

				const userId = userRow.id;

				await sql`
          INSERT INTO tenant_memberships (
            tenant_id, user_id, role, department, job_title, is_primary, joined_at
          ) VALUES (
            ${tenant.id}, ${userId}, ${role}, ${department}, ${jobTitle},
            ${i === 1}, ${faker.date.past({ years: 1 })}
          )
        `;

				users.push({
					id: userId,
					email,
					firstName,
					lastName,
					tenantId: tenant.id,
					role,
				});
			}

			console.log(`  ✓ ${tenant.name}: ${userCount} users`);
		}

		// Create role hierarchy
		console.log(" Creating role hierarchies...");
		for (const tenant of tenants) {
			const tenantUsers = users.filter((u) => u.tenantId === tenant.id);
			const owners = tenantUsers.filter((u) => u.role === "owner");
			const admins = tenantUsers.filter((u) => u.role === "admin");
			const managers = tenantUsers.filter((u) => u.role === "manager");

			for (const user of tenantUsers) {
				let reportsTo: User | undefined;
				let level = 0;

				if (user.role === "owner") {
					level = 0;
				} else if (user.role === "admin") {
					reportsTo = faker.helpers.arrayElement(owners);
					level = 1;
				} else if (user.role === "manager") {
					reportsTo = faker.helpers.arrayElement([...owners, ...admins]);
					level = 2;
				} else {
					reportsTo = faker.helpers.arrayElement([
						...owners,
						...admins,
						...managers,
					]);
					level = 3;
				}

				await sql`
          INSERT INTO role_hierarchy (tenant_id, user_id, reports_to, level)
          VALUES (
            ${tenant.id}, ${user.id}, ${reportsTo?.id || null}, ${level}
          )
        `;
			}
		}
		console.log("  ✓ Role hierarchies created");

		// Create projects
		console.log(" Creating projects...");
		for (const tenant of tenants) {
			const projectCount = faker.number.int(config.projectsPerTenant);
			const tenantUsers = users.filter((u) => u.tenantId === tenant.id);

			for (let i = 0; i < projectCount; i++) {
				const name = generateProjectName();
				const visibility = faker.helpers.arrayElement([
					"private",
					"private",
					"private",
					"internal",
					"public",
					"shared",
				]);
				const status = faker.helpers.arrayElement([
					"draft",
					"active",
					"active",
					"active",
					"paused",
					"completed",
				]);
				const owner = faker.helpers.arrayElement(tenantUsers);

				const startDate = faker.date.past({ years: 1 });
				const endDate =
					status === "completed"
						? faker.date.between({ from: startDate, to: new Date() })
						: faker.date.future({ years: 1 });

				const result = await sql`
          INSERT INTO projects (
            tenant_id, name, description, status, visibility, owner_id,
            start_date, end_date, budget, color, tags
          ) VALUES (
            ${tenant.id}, ${name}, ${faker.lorem.paragraph()},
            ${status}, ${visibility}, ${owner.id},
            ${startDate}, ${endDate},
            ${faker.number.int({ min: 10000, max: 1000000 })},
            ${faker.color.rgb()},
            ${faker.helpers.arrayElements(
							["urgent", "strategic", "client", "internal", "experimental"],
							{ min: 1, max: 3 },
						)}
          ) RETURNING id
        `;

				const projectRow = result[0];
				if (!projectRow) {
					throw new Error("Failed to create project");
				}

				const projectId = projectRow.id;

				// Add project members
				const memberCount = faker.number.int({
					min: 2,
					max: Math.min(10, tenantUsers.length),
				});
				const members = faker.helpers.arrayElements(tenantUsers, memberCount);

				for (const member of members) {
					await sql`
            INSERT INTO project_members (project_id, user_id, role, permissions)
            VALUES (
              ${projectId}, ${member.id},
              ${faker.helpers.arrayElement([
								"lead",
								"member",
								"member",
								"member",
								"viewer",
								"client",
							])},
              ${JSON.stringify({
								read: true,
								write: member.role !== "viewer",
								admin: member.role === "owner",
							})}
            )
          `;
				}

				// Add project shares for some projects
				if (visibility === "shared" && faker.datatype.boolean(0.3)) {
					const otherTenants = tenants.filter((t) => t.id !== tenant.id);
					if (otherTenants.length > 0) {
						const sharedTenant = faker.helpers.arrayElement(otherTenants);
						await sql`
              INSERT INTO project_shares (
                project_id, shared_with_tenant_id, share_type, permissions, created_by
              ) VALUES (
                ${projectId}, ${sharedTenant.id}, 'tenant',
                ${JSON.stringify({ read: true, write: false, admin: false })},
                ${owner.id}
              )
            `;
					}
				}

				projects.push({
					id: projectId,
					tenantId: tenant.id,
					name,
					ownerId: owner.id,
					visibility,
					status,
				});
			}

			console.log(`  ✓ ${tenant.name}: ${projectCount} projects`);
		}

		// Create tasks
		console.log(" Creating tasks...");
		for (const project of projects) {
			const taskCount = faker.number.int(config.tasksPerProject);
			const projectUsers = users.filter((u) => u.tenantId === project.tenantId);

			for (let i = 0; i < taskCount; i++) {
				const title = generateTaskTitle();
				const status = faker.helpers.arrayElement([
					"backlog",
					"todo",
					"todo",
					"in_progress",
					"in_progress",
					"in_review",
					"blocked",
					"completed",
				]);
				const priority = faker.helpers.arrayElement([
					"low",
					"medium",
					"medium",
					"high",
					"high",
					"urgent",
					"critical",
				]);
				const assignee = faker.datatype.boolean(0.8)
					? faker.helpers.arrayElement(projectUsers)
					: null;
				const reporter = faker.helpers.arrayElement(projectUsers);
				const isPrivate = faker.datatype.boolean(0.1);

				const dueDate = faker.date.future({ years: 0.5 });

				const result = await sql`
          INSERT INTO tasks (
            tenant_id, project_id, title, description, status, priority,
            assignee_id, reporter_id, due_date, estimated_hours, labels,
            is_private, watcher_ids
          ) VALUES (
            ${project.tenantId}, ${project.id}, ${title}, ${faker.lorem.paragraphs(2)},
            ${status}, ${priority},
            ${assignee?.id || null}, ${reporter.id}, ${dueDate},
            ${faker.number.int({ min: 1, max: 40 })},
            ${faker.helpers.arrayElements(
							["bug", "feature", "docs", "refactor", "urgent"],
							{ min: 0, max: 3 },
						)},
            ${isPrivate},
            ${faker.helpers.arrayElements(
							projectUsers.map((u) => u.id),
							{ min: 0, max: 3 },
						)}
          ) RETURNING id
        `;

				const taskRow = result[0];
				if (!taskRow) {
					throw new Error("Failed to create task");
				}

				tasks.push({
					id: taskRow.id,
					tenantId: project.tenantId,
					projectId: project.id,
					title,
					status,
					priority,
					assigneeId: assignee?.id || null,
					reporterId: reporter.id,
					isPrivate,
				});
			}
		}
		console.log(`  ✓ ${tasks.length} tasks created`);

		// Create documents
		console.log(" Creating documents...");
		for (const tenant of tenants) {
			const docCount = faker.number.int(config.documentsPerTenant);
			const tenantUsers = users.filter((u) => u.tenantId === tenant.id);
			const tenantProjects = projects.filter((p) => p.tenantId === tenant.id);

			for (let i = 0; i < docCount; i++) {
				const title = generateDocumentTitle();
				const owner = faker.helpers.arrayElement(tenantUsers);
				const visibility = faker.helpers.arrayElement([
					"private",
					"private",
					"shared",
					"team",
					"team",
					"project",
					"public",
				]);
				const permissionLevel = faker.helpers.arrayElement([
					"view",
					"view",
					"comment",
					"edit",
					"admin",
				]);
				const projectId =
					visibility === "project" && tenantProjects.length > 0
						? faker.helpers.arrayElement(tenantProjects).id
						: null;

				const content = faker.lorem.paragraphs(
					faker.number.int({ min: 3, max: 20 }),
				);

				const result = await sql`
          INSERT INTO documents (
            tenant_id, project_id, title, content, content_type,
            owner_id, visibility, permission_level, tags
          ) VALUES (
            ${tenant.id}, ${projectId}, ${title}, ${content}, 'text/markdown',
            ${owner.id}, ${visibility}, ${permissionLevel},
            ${faker.helpers.arrayElements(
							["spec", "guide", "policy", "report", "notes"],
							{ min: 1, max: 3 },
						)}
          ) RETURNING id
        `;

				const docRow = result[0];
				if (!docRow) {
					throw new Error("Failed to create document");
				}

				const documentId = docRow.id;

				// Add document permissions for some documents
				if (visibility === "shared" && faker.datatype.boolean(0.5)) {
					const permissionCount = faker.number.int({ min: 1, max: 5 });
					const permissionUsers = faker.helpers.arrayElements(
						tenantUsers,
						permissionCount,
					);

					for (const user of permissionUsers) {
						await sql`
              INSERT INTO document_permissions (
                document_id, user_id, permission_level, granted_by
              ) VALUES (
                ${documentId}, ${user.id},
                ${faker.helpers.arrayElement(["view", "comment", "edit"])},
                ${owner.id}
              )
            `;
					}
				}

				documents.push({
					id: documentId,
					tenantId: tenant.id,
					projectId,
					title,
					ownerId: owner.id,
					visibility,
					permissionLevel,
					content,
				});
			}
		}
		console.log(`  ✓ ${documents.length} documents created`);

		// Create comments
		console.log(" Creating comments...");
		let commentCount = 0;

		for (const task of tasks) {
			if (faker.datatype.boolean(0.3)) {
				const taskCommentCount = faker.number.int({ min: 1, max: 5 });
				const taskUsers = users.filter((u) => u.tenantId === task.tenantId);

				for (let i = 0; i < taskCommentCount; i++) {
					const author = faker.helpers.arrayElement(taskUsers);
					const isInternal = faker.datatype.boolean(0.1);

					await sql`
            INSERT INTO comments (
              tenant_id, entity_type, entity_id, author_id, content,
              is_internal, created_at
            ) VALUES (
              ${task.tenantId}, 'task', ${task.id}, ${author.id},
              ${faker.lorem.paragraphs(1)},
              ${isInternal}, ${faker.date.recent({ days: 30 })}
            )
          `;
					commentCount++;
				}
			}
		}
		console.log(`  ✓ ${commentCount} comments created`);

		// Create API keys
		console.log(" Creating API keys...");
		for (const tenant of tenants) {
			if (faker.datatype.boolean(0.3)) {
				const tenantUsers = users.filter((u) => u.tenantId === tenant.id);
				const keyCount = faker.number.int({ min: 1, max: 3 });

				for (let i = 0; i < keyCount; i++) {
					const creator = faker.helpers.arrayElement(tenantUsers);
					const keyPrefix = `rlm_${faker.string.alphanumeric(8)}`;

					await sql`
            INSERT INTO api_keys (
              tenant_id, name, key_hash, key_prefix, created_by,
              scopes, expires_at, is_active
            ) VALUES (
              ${tenant.id}, 
              ${faker.helpers.arrayElement([
								"Production",
								"Staging",
								"Development",
								"Integration",
							])},
              ${faker.string.alphanumeric(64)}, ${keyPrefix},
              ${creator.id},
              ${faker.helpers.arrayElements(
								["read", "write", "admin", "webhooks"],
								{ min: 1, max: 3 },
							)},
              ${faker.datatype.boolean(0.7) ? faker.date.future({ years: 1 }) : null},
              ${faker.datatype.boolean(0.9)}
            )
          `;
				}
			}
		}
		console.log("  ✓ API keys created");

		// Create custom roles
		console.log(" Creating custom roles...");
		const roleNamesList = [
			"Contractor",
			"Client",
			"Auditor",
			"Intern",
			"Consultant",
		];

		for (const tenant of tenants) {
			if (faker.datatype.boolean(0.5)) {
				const roleCount = faker.number.int({ min: 1, max: 3 });

				for (let i = 0; i < roleCount; i++) {
					const name = roleNamesList[i];
					if (!name) continue;

					await sql`
            INSERT INTO custom_roles (tenant_id, name, description, permissions)
            VALUES (
              ${tenant.id}, ${name}, ${faker.lorem.sentence()},
              ${JSON.stringify({
								can_view_projects: true,
								can_edit_tasks: name !== "Client",
								can_view_documents: true,
								can_comment: true,
								can_invite_users: false,
							})}
            )
          `;
				}
			}
		}
		console.log("  ✓ Custom roles created");

		// Print summary
		console.log("\n Seeding Complete!");
		console.log("====================");
		console.log(`Tenants: ${tenants.length}`);
		console.log(`Users: ${users.length}`);
		console.log(`Projects: ${projects.length}`);
		console.log(`Tasks: ${tasks.length}`);
		console.log(`Documents: ${documents.length}`);
		console.log(`Comments: ${commentCount}`);
		console.log("\n🔌 Connection string:");
		console.log(`  ${DATABASE_URL}`);
		console.log("\n Sample queries to test RLS:");
		console.log(
			"  SELECT * FROM projects; -- Will be empty without JWT claims",
		);
		const firstUser = users[0];
		if (firstUser) {
			console.log(
				`  SET LOCAL request.jwt.claims.user_id = '${firstUser.id}';`,
			);
			console.log(
				`  SET LOCAL request.jwt.claims.tenant_id = '${firstUser.tenantId}';`,
			);
		}
		console.log("  SELECT * FROM projects; -- Now shows filtered results");
	} catch (error) {
		console.error("❌ Seeding failed:", error);
		process.exit(1);
	} finally {
		await sql.end();
	}
}

seed();
