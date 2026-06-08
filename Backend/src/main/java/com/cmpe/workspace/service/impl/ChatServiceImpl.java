package com.cmpe.workspace.service.impl;

import com.cmpe.workspace.entity.Chat;
import com.cmpe.workspace.entity.Message;
import com.cmpe.workspace.entity.Participant;
import com.cmpe.workspace.entity.User;
import com.cmpe.workspace.enums.ChatType;
import com.cmpe.workspace.repository.ChatRepository;
import com.cmpe.workspace.repository.MessageRepository;
import com.cmpe.workspace.repository.ParticipantRepository;
import com.cmpe.workspace.repository.UserRepository;
import com.cmpe.workspace.service.facade.ChatService;
import com.cmpe.workspace.ws.dto.responce.ChatResponce;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@RequiredArgsConstructor
@Service
public class ChatServiceImpl implements ChatService {

    private final ParticipantRepository participantRepository;
    private final MessageRepository messageRepository;
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;

    @Override
    public List<ChatResponce> findUserChats(Authentication auth) {
        User user = (User) auth.getPrincipal();
        List<Chat> chats = participantRepository.findChatsByParticipants(user.getId());
        List<ChatResponce> res = new ArrayList<>();
        for(Chat chat : chats){
            Message lastMessage = messageRepository.findLastTextMessage(chat.getId());


            res.add(ChatResponce.builder()
                    .id(chat.getId())
                    .type(chat.getType())
                    .name(chat.getType() == ChatType.GROUP ? chat.getName() : chatName(chat.getId(), user.getId()))
                    .unreadCount(messageRepository.CountUnseenMessages(chat.getId(), user.getId()))
                    .lastMessage(lastMessage != null ? lastMessage.getContent() : null)
                    .lastMessageDate(lastMessage != null ? lastMessage.getCreatedAt(): null)
                    .build()
            );

        }
        return res;
    }

    @Override
    @Transactional
    public Chat createPrivatChat( Long senderId, Long receiverId) {
        User senderUser = userRepository.findById(senderId).get();
        User receiverUser = userRepository.findById(receiverId).orElseThrow(()-> new RuntimeException("receiver not found"));
        boolean chatAlreadyExists = chatRepository.existsDirectChatBetweenUsers(senderId, receiverId);
        if (chatAlreadyExists) {
            throw new IllegalArgumentException("Chat already exists");
        }
        Chat chat = new Chat();
        chat.setType(ChatType.DIRECT);
        chatRepository.save(chat);
        Participant sender = new Participant();
        sender.setChat(chat);
        sender.setUser(senderUser);

        Participant receiver = new Participant();
        receiver.setChat(chat);
        receiver.setUser(receiverUser);
        participantRepository.saveAll(List.of(sender, receiver));
        return chat;
    }




    public String chatName(long chatId, long userId){
        User receiver  = participantRepository.findReceiver(chatId, userId)
                .orElseThrow(() -> new RuntimeException("Receiver not Found"));
        return receiver.getFullName();
    }






}
