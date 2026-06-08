package com.cmpe.workspace.ws.dto;

import com.cmpe.workspace.enums.MessageType;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Notification {
    private Long messageId;
    private Long chatId;
    private String content;
    private Long senderId;
    private MessageType messageType;
    private String mediaUrl;
    private LocalDateTime createdAt;
}