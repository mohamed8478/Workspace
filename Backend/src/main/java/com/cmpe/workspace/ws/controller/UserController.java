package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.service.impl.UserService;
import com.cmpe.workspace.ws.dto.request.UserRoleRequest;
import com.cmpe.workspace.ws.dto.responce.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;

    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getUsers(@RequestParam String q){
        return ResponseEntity.ok(userService.searchByFullname(q));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<UserResponse> updateRole(
            @PathVariable Long id,
            @RequestBody UserRoleRequest request,
            @AuthenticationPrincipal User currentUser) {
        return ResponseEntity.ok(userService.updateRole(id, request, currentUser));
    }
}
