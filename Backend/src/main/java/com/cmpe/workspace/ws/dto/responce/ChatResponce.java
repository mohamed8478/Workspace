package com.cmpe.workspace.ws.dto.responce;

import com.cmpe.workspace.enums.ChatType;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class ChatResponce {
    private Long id;
    private String name;
    private ChatType type;
    private Integer unreadCount;
    private String lastMessage;
    private LocalDateTime lastMessageDate;
}
