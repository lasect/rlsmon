export interface RoleInfo {
	name: string;
	isSuperuser: boolean;
	canLogin: boolean;
	canCreateRole: boolean;
	canCreateDb: boolean;
	canBypassRls: boolean;
	canReplicate: boolean;
	inheritPrivileges: boolean;
	connectionLimit: number;
	memberOf: string[];
}
