package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Chat;
import com.cmpe.workspace.entity.Message;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.enums.MessageStatus;
import com.cmpe.workspace.enums.MessageType;
import com.cmpe.workspace.repository.ChatRepository;
import com.cmpe.workspace.repository.MessageRepository;
import com.cmpe.workspace.repository.ParticipantRepository;
import com.cmpe.workspace.repository.UserRepository;
import com.cmpe.workspace.service.facade.ChatService;
import com.cmpe.workspace.service.facade.MessageService;
import com.cmpe.workspace.service.file.FileService;
import com.cmpe.workspace.service.file.FileUtils;
import com.cmpe.workspace.ws.dto.request.MessageRequest;
import com.cmpe.workspace.ws.dto.responce.MessageResponse;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;


@RequiredArgsConstructor
@Service
public class MessageServiceImpl implements MessageService {

    private final MessageRepository messageRepository;
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;
    private final ParticipantRepository participantRepository;
    private final NotificationService notificationService;
    private final ChatService chatService;
    private final FileService fileService;

    @Value("${app.file.uploads.media-output-path}")
    private String mediaUploadPath;

    @Override
    public List<MessageResponse> findMessages(Long chatId, Long userId) {
        User receiverUser = userRepository.findById(userId).orElseThrow(()-> new RuntimeException("User not found"));
        Chat chat = chatRepository.findById(chatId).orElseThrow(()-> new RuntimeException("Chat not found"));
        updateToSeenMessage(chat.getId(), receiverUser.getId());
        List<Message> msg = messageRepository.findByChatIdOrderByCreatedAtAsc(chat.getId());
        List<MessageResponse> res = new ArrayList<>();
        for(Message message : msg ){
            res.add(toMessageResponse(message));
        }
        return res;
    }

    private void updateToSeenMessage(Long chatId, Long userId){
        List<Message> unseenMsg = messageRepository.findByUnseenMessage(chatId ,userId);
        if(!unseenMsg.isEmpty()){
            unseenMsg.forEach(m -> {
                m.setStatus(MessageStatus.SEEN);
            });
            messageRepository.saveAll(unseenMsg);
        }
    }

    @Transactional
    public MessageResponse addMessage(MessageRequest messageRequest , Long senderId){

        Chat chat = getChat(messageRequest, senderId);
        User sender = userRepository.findById(senderId).orElseThrow(()-> new EntityNotFoundException("Sender not Found"));

        validateParticipant(chat.getId(), senderId);
        Message message = new Message();
        message.setChat(chat);
        message.setContent(messageRequest.getContent());
        message.setSender(sender);
        message.setType(MessageType.TEXT);
        message.setStatus(MessageStatus.SENT);
        messageRepository.save(message);

        chat.setLastMessageAt(message.getCreatedAt());
        chatRepository.save(chat);
        notificationService.notifyParticipants(chat, message, sender);

        return toMessageResponse(message);
    }


    @Transactional
    public MessageResponse uploadMediaMessage(MessageRequest messageRequest, MultipartFile file, Long senderId) {
        Chat chat = getChat(messageRequest, senderId);
        User sender = userRepository.findById(senderId).orElseThrow(()-> new EntityNotFoundException("Sender not Found"));
        validateParticipant(chat.getId(), senderId);
        final String filePath = fileService.saveFile(file, senderId);
        Message message = new Message();
        message.setChat(chat);
        message.setContent(messageRequest.getContent());
        message.setSender(sender);
        message.setType(MessageType.FILE);
        message.setMediaFilePath(filePath);
        message.setStatus(MessageStatus.SENT);
        messageRepository.save(message);
        chat.setLastMessageAt(message.getCreatedAt());
        chatRepository.save(chat);
        notificationService.notifyParticipants(chat, message, sender);

        return toMessageResponse(message);
    }


    private void validateParticipant(Long chatId, Long senderId) {

        boolean isParticipant =
                participantRepository.existsByChatIdAndUserId(chatId, senderId);

        if (!isParticipant) {
            throw new IllegalArgumentException(
                    "Sender is not a participant of this chat"
            );
        }
    }

    private Chat getChat(MessageRequest request, Long senderId){
        if (request.getChatId() != null) {

            return chatRepository.findById(request.getChatId())
                    .orElseThrow(() ->
                            new EntityNotFoundException("Chat does not exist"));
        }

        if (request.getReceiverId() != null) {

            return chatService.createPrivatChat(senderId, request.getReceiverId());
        }

        throw new IllegalArgumentException(
                "Either chatId or receiverId must be provided"
        );
    }

    private MessageResponse toMessageResponse(Message message) {
        return MessageResponse.builder()
                .id(message.getId())
                .chatId(message.getChat().getId())
                .content(message.getContent())
                .senderId(message.getSender().getId())
                .type(message.getType())
                .status(message.getStatus())
                .createdAt(message.getCreatedAt())
                .media(FileUtils.readFileFromLocation(message.getMediaFilePath(), mediaUploadPath))
                .build();
    }

}
