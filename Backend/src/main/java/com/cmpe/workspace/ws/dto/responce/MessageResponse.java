package com.cmpe.workspace.ws.dto.responce;

import com.cmpe.workspace.enums.MessageStatus;
import com.cmpe.workspace.enums.MessageType;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MessageResponse {

    private Long id;
    private Long chatId;
    private String content;
    private MessageType type;
    private MessageStatus status;
    private Long senderId;
    private LocalDateTime createdAt;
    private byte[] media;
}
