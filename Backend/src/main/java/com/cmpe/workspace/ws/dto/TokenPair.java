package com.cmpe.workspace.ws.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class TokenPair {
    private String accessToken;
    private String refreshToken;

}