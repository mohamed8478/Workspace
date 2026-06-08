package com.cmpe.workspace.service.facade;

import com.cmpe.workspace.entity.Chat;
import com.cmpe.workspace.enums.ChatType;
import com.cmpe.workspace.ws.dto.responce.ChatResponce;
import org.springframework.security.core.Authentication;

import java.util.List;

public interface ChatService {

    List<ChatResponce> findUserChats(Authentication user);
    Chat createPrivatChat(Long senderId, Long receiverId);

    }
