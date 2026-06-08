package com.cmpe.workspace.ws.dto.request;

import com.cmpe.workspace.enums.MessageStatus;
import com.cmpe.workspace.enums.MessageType;
import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class MessageRequest {
    private String content;
    private Long receiverId;
    private Long chatId;
}
