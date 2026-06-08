package com.cmpe.workspace.ws.controller;

import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.service.facade.MessageService;
import com.cmpe.workspace.ws.dto.request.MessageRequest;
import com.cmpe.workspace.ws.dto.responce.MessageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/message")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping("/chat/{id}")
    public ResponseEntity<List<MessageResponse>> getAllMessages(@PathVariable("id") Long chatId, Authentication authentication ){
        User user = (User) authentication.getPrincipal();
        return ResponseEntity.ok(
                messageService.findMessages(chatId, user.getId() )
        );
    }


    @PostMapping("/add")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse sendMessage( @RequestBody MessageRequest message , Authentication authentication){
        User sender = (User) authentication.getPrincipal();
        return messageService.addMessage(message, sender.getId());
    }

    @PostMapping(value = "/add-media", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse sendMediaMessage(@RequestPart("message") MessageRequest message ,@RequestPart("file") MultipartFile file, Authentication authentication){
        User sender = (User) authentication.getPrincipal();
        return messageService.uploadMediaMessage(message, file, sender.getId());
    }


}
