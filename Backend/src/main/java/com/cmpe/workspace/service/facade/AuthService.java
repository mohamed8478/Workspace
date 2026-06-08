package com.cmpe.workspace.service.facade;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.ws.dto.TokenPair;
import com.cmpe.workspace.ws.dto.request.LoginRequest;
import com.cmpe.workspace.ws.dto.request.RefreshTokenRequest;
import com.cmpe.workspace.ws.dto.request.RegisterRequest;
import jakarta.validation.Valid;

public interface AuthService {
    TokenPair login(LoginRequest request);
    void register(RegisterRequest registerRequest);
    TokenPair refreshToken(@Valid RefreshTokenRequest request);
}
