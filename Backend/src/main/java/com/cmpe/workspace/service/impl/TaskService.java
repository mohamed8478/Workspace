package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.SubTask;
import com.cmpe.workspace.entity.Task;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.enums.Department;
import com.cmpe.workspace.enums.Role;
import com.cmpe.workspace.enums.TaskStatus;
import com.cmpe.workspace.repository.TaskRepository;
import com.cmpe.workspace.repository.UserRepository;
import com.cmpe.workspace.ws.dto.request.SubTaskRequest;
import com.cmpe.workspace.ws.dto.request.TaskRequest;
import com.cmpe.workspace.ws.dto.responce.SubTaskResponse;
import com.cmpe.workspace.ws.dto.responce.TaskResponse;
import com.cmpe.workspace.ws.dto.responce.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;

@RequiredArgsConstructor
@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<TaskResponse> getTasks(User currentUser) {
        List<Task> tasks = isAdmin(currentUser)
                ? taskRepository.findByCreatedByIdOrderByDueDateAsc(currentUser.getId())
                : taskRepository.findByAssignedToIdOrderByDueDateAsc(currentUser.getId());

        return tasks
                .stream()
                .sorted(Comparator.comparing(Task::getDueDate))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public TaskResponse getTask(Long id, User currentUser) {
        Task task = findTask(id);
        ensureCanView(task, currentUser);
        return toResponse(task);
    }

    @Transactional
    public TaskResponse createTask(TaskRequest request, User currentUser) {
        ensureAdmin(currentUser);
        validateTaskRequest(request);

        Task task = new Task();
        task.setTitle(request.getTitle().trim());
        task.setDescription(request.getDescription());
        task.setDueDate(request.getDueDate());
        task.setStatus(request.getStatus() == null ? TaskStatus.ACTIVE : request.getStatus());
        task.setDepartment(request.getDepartment() == null ? Department.ServiceInformatique : request.getDepartment());
        task.setAssignedTo(resolveAssignedUser(request.getAssignedToId()));
        task.setCreatedBy(currentUser);

        if (request.getSubtasks() != null) {
            for (SubTaskRequest subTaskRequest : request.getSubtasks()) {
                addSubtaskToTask(task, subTaskRequest, task.getSubtasks().size());
            }
        }

        return toResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse addSubtask(Long taskId, SubTaskRequest request, User currentUser) {
        Task task = findTask(taskId);
        ensureCanManageAndComplete(task, currentUser);
        addSubtaskToTask(task, request, task.getSubtasks().size());
        return toResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse completeTask(Long id, User currentUser) {
        Task task = findTask(id);
        ensureCanComplete(task, currentUser);
        task.setStatus(TaskStatus.COMPLETED);
        return toResponse(taskRepository.save(task));
    }

    @Transactional
    public TaskResponse completeSubtask(Long taskId, Long subTaskId, User currentUser) {
        Task task = findTask(taskId);
        ensureCanComplete(task, currentUser);

        SubTask subTask = task.getSubtasks()
                .stream()
                .filter(current -> current.getId().equals(subTaskId))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Subtask not found"));

        subTask.setCompleted(true);
        return toResponse(taskRepository.save(task));
    }

    public void deleteTask(Long id, User currentUser) {
        Task task = findTask(id);
        ensureCanManage(task, currentUser);
        if (!taskRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found");
        }
        taskRepository.deleteById(id);
    }

    private Task findTask(Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task not found"));
    }

    private void addSubtaskToTask(Task task, SubTaskRequest request, int position) {
        if (request == null || request.getTitle() == null || request.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Subtask title is required");
        }

        SubTask subTask = new SubTask();
        subTask.setTitle(request.getTitle().trim());
        subTask.setCompleted(Boolean.TRUE.equals(request.getCompleted()));
        subTask.setPosition(position);
        task.addSubtask(subTask);
    }

    private void validateTaskRequest(TaskRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task payload is required");
        }
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task title is required");
        }
        if (request.getDueDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Task due date is required");
        }
    }

    private User resolveAssignedUser(Long assignedToId) {
        if (assignedToId == null) {
            return null;
        }

        return userRepository.findById(assignedToId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Assigned user not found"));
    }

    private void ensureAdmin(User user) {
        if (!isAdmin(user)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role is required");
        }
    }

    private void ensureCanView(Task task, User user) {
        if (isCreator(task, user)) {
            return;
        }

        User assignedTo = task.getAssignedTo();
        if (assignedTo != null && assignedTo.getId().equals(user.getId())) {
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only access tasks assigned to you");
    }

    private void ensureCanManage(Task task, User user) {
        if (isCreator(task, user)) {
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only manage tasks you created");
    }

    private void ensureCanManageAndComplete(Task task, User user) {
        ensureCanManage(task, user);
        ensureCanComplete(task, user);
    }

    private void ensureCanComplete(Task task, User user) {
        User assignedTo = task.getAssignedTo();
        if (assignedTo != null && assignedTo.getId().equals(user.getId())) {
            return;
        }

        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only complete tasks assigned to you");
    }

    private boolean isAdmin(User user) {
        return user != null && user.getRole() == Role.ADMIN;
    }

    private boolean isCreator(Task task, User user) {
        User createdBy = task.getCreatedBy();
        return isAdmin(user) && createdBy != null && createdBy.getId().equals(user.getId());
    }

    private TaskResponse toResponse(Task task) {
        return TaskResponse.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .dueDate(task.getDueDate())
                .status(task.getStatus())
                .department(task.getDepartment())
                .assignedTo(toUserResponse(task.getAssignedTo()))
                .createdBy(toUserResponse(task.getCreatedBy()))
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .subtasks(
                        task.getSubtasks() == null ? List.of() :
                                task.getSubtasks()
                                        .stream()
                                        .map(this::toResponse)
                                        .toList()
                )
                .build();
    }

    private UserResponse toUserResponse(User user) {
        if (user == null) {
            return null;
        }

        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .build();
    }

    private SubTaskResponse toResponse(SubTask subTask) {
        return SubTaskResponse.builder()
                .id(subTask.getId())
                .title(subTask.getTitle())
                .completed(subTask.isCompleted())
                .position(subTask.getPosition())
                .build();
    }
}
