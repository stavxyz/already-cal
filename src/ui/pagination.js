// src/ui/pagination.js

export function paginateEvents(events, showPast, pageSize, paginationState) {
  if (!events || events.length === 0) {
    return { visible: [], hasMoreFuture: false, hasMorePast: false, remainingFuture: 0, remainingPast: 0 };
  }

  if (!showPast) {
    const limit = pageSize + paginationState.futureCount;
    const visible = events.slice(0, limit);
    const remainingFuture = Math.max(0, events.length - limit);
    return {
      visible,
      hasMoreFuture: remainingFuture > 0,
      hasMorePast: false,
      remainingFuture,
      remainingPast: 0,
    };
  }

  // showPast is true — split into past and future by checking event dates
  const now = new Date();
  const past = [];
  const future = [];
  for (const event of events) {
    const endOrStart = event.end || event.start;
    if (new Date(endOrStart) < now) {
      past.push(event);
    } else {
      future.push(event);
    }
  }

  // Past events: reverse chronological (most recent past first)
  const pastReversed = [...past].reverse();
  const pastLimit = pageSize + paginationState.pastCount;
  const visiblePast = pastReversed.slice(0, pastLimit);
  const remainingPast = Math.max(0, pastReversed.length - pastLimit);

  // Future events: chronological (soonest first)
  const futureLimit = pageSize + paginationState.futureCount;
  const visibleFuture = future.slice(0, futureLimit);
  const remainingFuture = Math.max(0, future.length - futureLimit);

  // Combine: past (re-reversed to chronological for display) + future
  const visiblePastChronological = [...visiblePast].reverse();
  const visible = [...visiblePastChronological, ...visibleFuture];

  return {
    visible,
    hasMoreFuture: remainingFuture > 0,
    hasMorePast: remainingPast > 0,
    remainingFuture,
    remainingPast,
  };
}
