package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.enums.Role;
import com.cmpe.workspace.repository.UserRepository;
import com.cmpe.workspace.ws.dto.request.UserRoleRequest;
import com.cmpe.workspace.ws.dto.responce.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RequiredArgsConstructor
@Service
public class UserService {
    private final UserRepository userRepository;

    public List<UserResponse> searchByFullname(String query) {
        if (query == null || query.isBlank()) return List.of();

        return userRepository
                .findByFullNameStartingWithIgnoreCase(query.trim())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public UserResponse updateRole(Long userId, UserRoleRequest request, User currentUser) {
        if (request == null || request.getRole() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Role is required");
        }

        boolean adminExists = userRepository.existsByRole(Role.ADMIN);
        if (adminExists && (currentUser == null || currentUser.getRole() != Role.ADMIN)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin role is required");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setRole(request.getRole());
        return toResponse(userRepository.save(user));
    }

    private UserResponse toResponse(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();
    }

}
