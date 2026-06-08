package com.cmpe.workspace.ws.dto.request;

import com.cmpe.workspace.enums.Role;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class UserRoleRequest {
    private Role role;
}
