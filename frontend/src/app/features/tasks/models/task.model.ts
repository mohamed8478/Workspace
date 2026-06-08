export type TaskStatus = 'ACTIVE' | 'COMPLETED';

export type TaskDepartment =
  | 'Achat'
  | 'Maintenance'
  | 'Production'
  | 'ControleDeGestion'
  | 'ServiceInformatique'
  | 'HR'
  | 'ENGINEERING'
  | 'PRODUCT_DESIGN'
  | 'MARKETING'
  | 'SALES'
  | 'CUSTOMER_SUCCESS'
  | 'FINANCE'
  | 'HR'
  | 'OPERATIONS'
  | 'DEVOPS'
  | 'SUPPORT';

export interface SubTask {
  readonly id: number;
  readonly title: string;
  readonly completed: boolean;
  readonly position: number;
}

export interface TaskAssignee {
  readonly id: number;
  readonly fullName: string;
}

export interface Task {
  readonly id: number;
  readonly title: string;
  readonly description?: string;
  readonly dueDate: string;
  readonly status: TaskStatus;
  readonly department: TaskDepartment;
  readonly assignedTo?: TaskAssignee | null;
  readonly createdBy?: TaskAssignee | null;
  readonly createdAt?: string;
  readonly updatedAt?: string;
  readonly subtasks: SubTask[];
}

export interface SubTaskRequest {
  readonly title: string;
  readonly completed?: boolean;
}

export interface TaskRequest {
  readonly title: string;
  readonly description?: string;
  readonly dueDate: string;
  readonly status: TaskStatus;
  readonly department: TaskDepartment;
  readonly assignedToId?: number | null;
  readonly subtasks: SubTaskRequest[];
}

export interface DepartmentOption {
  readonly value: TaskDepartment;
  readonly label: string;
}

export const TASK_DEPARTMENTS: DepartmentOption[] = [
  { value: 'ServiceInformatique', label: 'Service Informatique' },
  { value: 'Achat', label: 'Achat' },
  { value: 'HR', label: 'HR' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Production', label: 'Production' },
  { value: 'ControleDeGestion', label: 'Controle de Gestion' },
];
