package com.cmpe.workspace.service.facade;

import com.cmpe.workspace.ws.dto.request.MessageRequest;
import com.cmpe.workspace.ws.dto.responce.MessageResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface MessageService {
    List<MessageResponse> findMessages(Long chatId, Long userId);
    MessageResponse addMessage(MessageRequest messageRequest , Long senderId);
    MessageResponse uploadMediaMessage(MessageRequest messageRequest, MultipartFile file, Long senderId);
}
