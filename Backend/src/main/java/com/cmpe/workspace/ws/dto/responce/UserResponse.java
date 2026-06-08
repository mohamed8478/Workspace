package com.cmpe.workspace.ws.dto.responce;

import com.cmpe.workspace.enums.Role;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserResponse {
    private Long id;
    private String fullName;
    private Role role;
}
