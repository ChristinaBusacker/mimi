import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';

import { EventsService } from './events.service';

@ApiTags('Events')
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Sse('events')
  @ApiOperation({
    summary: 'Subscribe to backend events',
  })
  @ApiResponse({
    status: 200,
    description: 'Server-sent event stream.',
    content: {
      'text/event-stream': {
        schema: {
          type: 'string',
          example:
            'event: heartbeat\ndata: {"timestamp":"2026-09-19T19:00:00.000Z"}\n\n',
        },
      },
    },
  })
  events(): Observable<MessageEvent> {
    return this.eventsService.stream();
  }
}
