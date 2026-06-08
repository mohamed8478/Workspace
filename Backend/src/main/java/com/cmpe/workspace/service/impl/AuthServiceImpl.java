package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.repository.UserRepository;
import com.cmpe.workspace.security.service.JwtService;
import com.cmpe.workspace.service.facade.AuthService;
import com.cmpe.workspace.ws.dto.TokenPair;
import com.cmpe.workspace.ws.dto.request.LoginRequest;
import com.cmpe.workspace.ws.dto.request.RefreshTokenRequest;
import com.cmpe.workspace.ws.dto.request.RegisterRequest;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class AuthServiceImpl implements AuthService {

    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;


    @Override
    public TokenPair login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getUsername(), request.getPassword())
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
        return jwtService.generateTokenPair(authentication);
    }

    @Transactional
    @Override
    public void register(RegisterRequest registerRequest) {
        // Check if user with the same username already exist
        if(userRepository.existsByEmail(registerRequest.getUsername())) {
            throw new IllegalArgumentException("Username is already in use");
        }
        // Create new user
        User user = User
                .builder()
                .fullName(registerRequest.getFullName())
                .email(registerRequest.getUsername())
                .role(registerRequest.getRole())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .build();

        userRepository.save(user);
    }

    public TokenPair refreshToken(@Valid RefreshTokenRequest request) {

        String refreshToken = request.getRefreshToken();
        // check if it is valid refresh token
        if(!jwtService.isRefreshToken(refreshToken)) {
            throw new IllegalArgumentException("Invalid refresh token");
        }

        String user = jwtService.extractUsernameFromToken(refreshToken);
        UserDetails userDetails = userDetailsService.loadUserByUsername(user);


        UsernamePasswordAuthenticationToken authentication =
                new UsernamePasswordAuthenticationToken(
                        userDetails,
                        null,
                        userDetails.getAuthorities()
                );

        String accessToken = jwtService.generateAccessToken(authentication);
        return new TokenPair(accessToken, refreshToken);
    }


}
