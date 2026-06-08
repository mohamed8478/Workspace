package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.service.impl.TaskService;
import com.cmpe.workspace.ws.dto.request.SubTaskRequest;
import com.cmpe.workspace.ws.dto.request.TaskRequest;
import com.cmpe.workspace.ws.dto.responce.TaskResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public ResponseEntity<List<TaskResponse>> getTasks(@AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(taskService.getTasks(currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getTask(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(taskService.getTask(id, currentUser));
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(
            @RequestBody TaskRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.createTask(request, currentUser));
    }

    @PostMapping("/{id}/subtasks")
    public ResponseEntity<TaskResponse> addSubtask(
            @PathVariable Long id,
            @RequestBody SubTaskRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(taskService.addSubtask(id, request, currentUser));
    }

    @PostMapping("/{id}/subtasks/{subTaskId}/complete")
    public ResponseEntity<TaskResponse> completeSubtask(
            @PathVariable Long id,
            @PathVariable Long subTaskId,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(taskService.completeSubtask(id, subTaskId, currentUser));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<TaskResponse> completeTask(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(taskService.completeTask(id, currentUser));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long id,
            @AuthenticationPrincipal User currentUser) {
        taskService.deleteTask(id, currentUser);
        return ResponseEntity.noContent().build();
    }
}
