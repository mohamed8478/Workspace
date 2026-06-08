package com.cmpe.workspace.service.impl;

import io.livekit.server.*;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@RequiredArgsConstructor
@Service
public class LivekitAgentDispatchService {
    @Value("${app.livekit.api.key}")
    private String livekitApiKey;

    @Value("${app.livekit.api.secret}")
    private String livekitApiSecret;

    @Value("${app.livekit.api.url}")
    private String livekitHttpUrl;

    private final WebClient webClient = WebClient.builder().build();
    private final Set<String> dispatchedRooms = ConcurrentHashMap.newKeySet();
    public void dispatchSttAgentOnce(String roomName) {
        if (!dispatchedRooms.add(roomName)) {
            return; // already dispatched for this room
        }
        dispatchSttAgent(roomName);
    }
    public void dispatchSttAgent(String roomName) {
        RoomAdmin roomAdmin = new RoomAdmin(true);

        AccessToken token = new AccessToken(livekitApiKey, livekitApiSecret);
        token.setIdentity("backend-dispatcher");
        token.addGrants(roomAdmin, new RoomName(roomName));
        String serverJwt = token.toJwt();

        Map<String, Object> payload = Map.of(
                "agent_name", "stt-agent",
                "room", roomName,
                "metadata", "stt"
        );

        webClient.post()
                .uri(livekitHttpUrl + "/twirp/livekit.AgentDispatchService/CreateDispatch")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serverJwt)
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(payload)
                .retrieve()
                .bodyToMono(String.class)
                .block();
    }
}
