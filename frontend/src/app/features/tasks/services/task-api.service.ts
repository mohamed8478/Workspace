import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { SubTaskRequest, Task, TaskRequest } from '../models/task.model';

@Injectable({ providedIn: 'root' })
export class TaskApiService {
  private readonly http = inject(HttpClient);
  private readonly api = `${environment.apiUrl}/tasks`;

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.api);
  }

  getTask(id: number): Observable<Task> {
    return this.http.get<Task>(`${this.api}/${id}`);
  }

  createTask(request: TaskRequest): Observable<Task> {
    return this.http.post<Task>(this.api, request);
  }

  addSubtask(taskId: number, request: SubTaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.api}/${taskId}/subtasks`, request);
  }

  completeSubtask(taskId: number, subTaskId: number): Observable<Task> {
    return this.http.post<Task>(`${this.api}/${taskId}/subtasks/${subTaskId}/complete`, {});
  }

  completeTask(id: number): Observable<Task> {
    return this.http.post<Task>(`${this.api}/${id}/complete`, {});
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }
}
