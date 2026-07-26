/**
 * @deprecated This store is no longer used. Ticket management now uses
 * ticketService API calls directly (lib/api/ticket.ts).
 * Kept for reference only — safe to delete.
 */
import { create } from 'zustand';
import { Ticket, TicketMessage } from '../types';

interface TicketState {
  tickets: Ticket[];
  addTicket: (ticket: Omit<Ticket, 'id' | 'messages' | 'created_at' | 'updated_at'>) => void;
  updateTicket: (ticketId: number, updates: Partial<Ticket>) => void;
  addMessage: (ticketId: number, message: Omit<TicketMessage, 'id' | 'ticket_id' | 'created_at'>) => void;
  getTicketsByUserId: (userId: number) => Ticket[];
  getTicketById: (ticketId: number) => Ticket | undefined;
}

export const useTicketStore = create<TicketState>((set, get) => ({
  tickets: [],
  addTicket: (ticketData) =>
    set((state) => {
      const newTicket: Ticket = {
        ...ticketData,
        id: Date.now(),
        messages: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return { tickets: [...state.tickets, newTicket] };
    }),
  updateTicket: (ticketId, updates) =>
    set((state) => ({
      tickets: state.tickets.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, ...updates, updated_at: new Date().toISOString() }
          : ticket
      ),
    })),
  addMessage: (ticketId, messageData) =>
    set((state) => {
      const newMessage: TicketMessage = {
        ...messageData,
        id: Date.now(),
        ticket_id: ticketId,
        created_at: new Date().toISOString(),
      };
      return {
        tickets: state.tickets.map((ticket) =>
          ticket.id === ticketId
            ? {
                ...ticket,
                messages: [...ticket.messages, newMessage],
                updated_at: new Date().toISOString(),
              }
            : ticket
        ),
      };
    }),
  getTicketsByUserId: (userId) => {
    const { tickets } = get();
    return tickets.filter((ticket) => ticket.user_id === userId);
  },
  getTicketById: (ticketId) => {
    const { tickets } = get();
    return tickets.find((ticket) => ticket.id === ticketId);
  },
}));