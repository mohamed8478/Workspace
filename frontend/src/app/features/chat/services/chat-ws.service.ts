import {
    Injectable,
    NgZone,
    inject
} from '@angular/core';

import {
    Client,
    IMessage,
    Stomp
} from '@stomp/stompjs';

import SockJS from 'sockjs-client';

import { environment }
    from '../../../../environments/environment';

import { Notification }
    from '../models/notification.model';

import { ChatService }
    from './chat.service';

@Injectable({
    providedIn: 'root'
})
export class ChatWsService {

    private readonly chatService =
        inject(ChatService);
    private readonly zone = inject(NgZone);

    private client!: Client;

    /*
    |--------------------------------------------------------------------------
    | CONNECT
    |--------------------------------------------------------------------------
    */

    connect(token: string): void {

        // Prevent duplicate connections
        if (this.client?.active) {
            console.log('WebSocket already connected');
            return;
        }

        // Derive WS base URL from the API URL
        // e.g. 'http://localhost:8080/api' → 'http://localhost:8080'
        const baseUrl = environment.apiUrl
            .replace(/\/api\/?$/, '');

        this.client = new Client({

            webSocketFactory: () =>

                new SockJS(
                    `${baseUrl}/ws`
                ),

            connectHeaders: {

                Authorization:
                    `Bearer ${token}`
            },

            reconnectDelay: 5000,

            debug: (message) => {

                console.log(message);
            }
        });



        /*
        |--------------------------------------------------------------------------
        | CONNECTED
        |--------------------------------------------------------------------------
        */

        this.client.onConnect = () => {

            console.log(
                'WebSocket Connected'
            );

            this.subscribeToMessages();
        };

        /*
        |--------------------------------------------------------------------------
        | STOMP ERROR
        |--------------------------------------------------------------------------
        */

        this.client.onStompError = (frame) => {

            console.error(
                'Broker error',
                frame.headers['message']
            );

            console.error(frame.body);
        };

        /*
        |--------------------------------------------------------------------------
        | WEBSOCKET ERROR
        |--------------------------------------------------------------------------
        */

        this.client.onWebSocketError = (error) => {

            console.error(
                'WebSocket Error',
                error
            );
        };

        /*
        |--------------------------------------------------------------------------
        | ACTIVATE
        |--------------------------------------------------------------------------
        */

        this.client.activate();
    }

    /*
    |--------------------------------------------------------------------------
    | DISCONNECT
    |--------------------------------------------------------------------------
    */

    disconnect(): void {

        if (this.client?.active) {

            this.client.deactivate();

            console.log(
                'WebSocket Disconnected'
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | PRIVATE MESSAGE SUBSCRIPTION
    |--------------------------------------------------------------------------
    */

    private subscribeToMessages(): void {

        this.client.subscribe(

            '/user/queue/messages',

            (message: IMessage) => {

                this.zone.run(() => {

                    const notification: Notification =
                        JSON.parse(message.body);

                    console.log(
                        'Incoming Notification',
                        notification
                    );

                    this.chatService
                        .pushIncomingNotification(
                            notification
                        );
                });
            }
        );
    }
}
