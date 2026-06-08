import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  SubTaskRequest,
  TASK_DEPARTMENTS,
  Task,
  TaskDepartment,
} from '../../models/task.model';
import { TaskApiService } from '../../services/task-api.service';
import { UsersApiService } from '../../../../api/users-api.service';
import { UserSearchResult } from '../../../../shared/models/user-search.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TokenService } from '../../../../core/services/token.service';

type TaskFilter = 'ACTIVE' | 'COMPLETED' | 'OVERDUE';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tasks-page.component.html',
  styleUrl: './tasks-page.component.css',
})
export class TasksPageComponent implements OnInit {
  private readonly taskApi = inject(TaskApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);

  readonly departments = TASK_DEPARTMENTS;
  readonly tasks = signal<Task[]>([]);
  readonly filter = signal<TaskFilter>('ACTIVE');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly showComposer = signal(false);
  readonly isAdmin = computed(() => this.authService.hasRole('ADMIN'));

  readonly draftTitle = signal('');
  readonly draftDescription = signal('');
  readonly draftDueDate = signal('');
  readonly draftDepartment = signal<TaskDepartment>('ServiceInformatique');
  readonly assigneeQuery = signal('');
  readonly assigneeResults = signal<UserSearchResult[]>([]);
  readonly selectedAssignee = signal<UserSearchResult | null>(null);
  readonly draftSubtaskTitle = signal('');
  readonly draftSubtasks = signal<SubTaskRequest[]>([]);

  readonly activeCount = computed(() =>
    this.tasks().filter((task) => task.status === 'ACTIVE' && !this.isOverdue(task)).length
  );
  readonly completedCount = computed(() =>
    this.tasks().filter((task) => task.status === 'COMPLETED').length
  );
  readonly overdueCount = computed(() =>
    this.tasks().filter((task) => this.isOverdue(task)).length
  );
  readonly filteredTasks = computed(() => {
    const filter = this.filter();

    return this.tasks().filter((task) => {
      if (filter === 'OVERDUE') {
        return this.isOverdue(task);
      }

      return task.status === filter;
    });
  });

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading.set(true);
    this.error.set(null);

    this.taskApi.getTasks().subscribe({
      next: (tasks) => {
        this.tasks.set(tasks);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.message || 'Could not load tasks. Please try again.');
        this.loading.set(false);
      },
    });
  }

  setFilter(filter: TaskFilter): void {
    this.filter.set(filter);
  }

  updateDraftTitle(value: string): void {
    this.draftTitle.set(value);
  }

  updateDraftDescription(value: string): void {
    this.draftDescription.set(value);
  }

  updateDraftDueDate(value: string): void {
    this.draftDueDate.set(value);
  }

  updateDraftDepartment(value: string): void {
    this.draftDepartment.set(value as TaskDepartment);
  }

  updateAssigneeQuery(value: string): void {
    this.assigneeQuery.set(value);
    this.selectedAssignee.set(null);

    const query = value.trim();
    if (query.length < 2) {
      this.assigneeResults.set([]);
      return;
    }

    this.usersApi.searchUsers(query).subscribe({
      next: (users) => this.assigneeResults.set(users),
      error: () => this.assigneeResults.set([]),
    });
  }

  selectAssignee(user: UserSearchResult): void {
    this.selectedAssignee.set(user);
    this.assigneeQuery.set(user.fullName ?? 'Unnamed user');
    this.assigneeResults.set([]);
  }

  clearAssignee(): void {
    this.selectedAssignee.set(null);
    this.assigneeQuery.set('');
    this.assigneeResults.set([]);
  }

  updateDraftSubtaskTitle(value: string): void {
    this.draftSubtaskTitle.set(value);
  }

  addDraftSubtask(): void {
    const title = this.draftSubtaskTitle().trim();

    if (!title) {
      return;
    }

    this.draftSubtasks.update((subtasks) => [...subtasks, { title }]);
    this.draftSubtaskTitle.set('');
  }

  removeDraftSubtask(index: number): void {
    this.draftSubtasks.update((subtasks) => subtasks.filter((_, currentIndex) => currentIndex !== index));
  }

  createTask(): void {
    const title = this.draftTitle().trim();
    const dueDate = this.draftDueDate();

    if (!this.isAdmin()) {
      this.error.set('Only admins can create tasks.');
      return;
    }

    if (!title || !dueDate || this.saving()) {
      this.error.set('Title and due date are required.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    this.taskApi
      .createTask({
        title,
        description: this.draftDescription().trim(),
        dueDate: this.toApiDueDate(dueDate),
        status: 'ACTIVE',
        department: this.draftDepartment(),
        assignedToId: this.selectedAssignee()?.id ?? null,
        subtasks: this.draftSubtasks(),
      })
      .subscribe({
        next: (task) => {
          this.tasks.update((tasks) => [...tasks, task].sort((a, b) => this.dateMs(a.dueDate) - this.dateMs(b.dueDate)));
          this.resetComposer();
          this.saving.set(false);
        },
        error: () => {
          this.error.set('Could not create task. Please check the form and try again.');
          this.saving.set(false);
        },
      });
  }

  deleteTask(task: Task, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if (!this.isAdmin()) {
      this.error.set('Only admins can delete tasks.');
      return;
    }

    this.taskApi.deleteTask(task.id).subscribe({
      next: () => {
        this.tasks.update((tasks) => tasks.filter((current) => current.id !== task.id));
      },
      error: () => {
        this.error.set('Could not delete task.');
      },
    });
  }

  completeTask(task: Task, event: Event): void {
    event.stopPropagation();
    event.preventDefault();

    if (task.status === 'COMPLETED') {
      return;
    }

    this.taskApi.completeTask(task.id).subscribe({
      next: (updatedTask) => {
        this.tasks.update((tasks) =>
          tasks.map((current) => current.id === updatedTask.id ? updatedTask : current)
        );
      },
      error: () => {
        this.error.set('Could not submit task as completed.');
      },
    });
  }

  departmentLabel(department: TaskDepartment): string {
    return this.departments.find((option) => option.value === department)?.label ?? department;
  }

  assigneeName(task: Task): string {
    return task.assignedTo?.fullName ?? 'Unassigned';
  }

  canCompleteTask(task: Task): boolean {
    const currentUserId = this.currentUserId();
    return !!currentUserId && task.assignedTo?.id === currentUserId;
  }

  formatDueDate(value: string): string {
    const date = new Date(value);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }

    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  subtaskProgress(task: Task): string {
    if (task.subtasks.length === 0) {
      return '0/0';
    }

    return `${task.subtasks.filter((subtask) => subtask.completed).length}/${task.subtasks.length}`;
  }

  isOverdue(task: Task): boolean {
    return task.status === 'ACTIVE' && this.dateMs(task.dueDate) < Date.now();
  }

  private resetComposer(): void {
    this.draftTitle.set('');
    this.draftDescription.set('');
    this.draftDueDate.set('');
    this.draftDepartment.set('ServiceInformatique');
    this.clearAssignee();
    this.draftSubtaskTitle.set('');
    this.draftSubtasks.set([]);
    this.showComposer.set(false);
  }

  private dateMs(value: string): number {
    return new Date(value).getTime();
  }

  private toApiDueDate(date: string): string {
    return `${date}T00:00:00`;
  }

  private currentUserId(): number | null {
    const userId = this.tokenService.decodePayload()?.userId;
    const parsed = Number(userId);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
