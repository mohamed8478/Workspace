package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.entity.Chat;
import com.cmpe.workspace.service.facade.ChatService;
import com.cmpe.workspace.ws.dto.responce.ChatResponce;
import com.cmpe.workspace.ws.dto.responce.MessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;

    @GetMapping
    public ResponseEntity<List<ChatResponce>> getUserChats(Authentication auth){
        return ResponseEntity.ok(
                chatService.findUserChats(auth)
        );
    }





}
