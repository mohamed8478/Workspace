package com.cmpe.workspace.ws.dto.responce;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Builder
@Getter
@AllArgsConstructor
@NoArgsConstructor
public class TokenResponse {
    private String token;
    private String roomName;
    private Long meetingId;
}
