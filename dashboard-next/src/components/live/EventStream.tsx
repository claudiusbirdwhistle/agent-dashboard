"use client";

import { useLive } from "@/lib/hooks/useLive";
import EventCard from "./EventCard";

export default function EventStream() {
  const { data: events, isLoading, isError } = useLive();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
        Loading live events…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-24 text-red-400 text-sm">
        Failed to load events
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">
        No events yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[60vh] pr-1">
      {events.map((event, i) => (
        <EventCard key={`${event.timestamp}-${i}`} event={event} />
      ))}
    </div>
  );
}
