import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { branchPalette } from "@/constants/colors";
import { dropLegacyCache, loadTrips, saveTrips } from "@/lib/storage";
import { buildSeedTrips } from "@/lib/seed";
import { genId } from "@/lib/time";
import type { Branch, Segment, Trip } from "@/lib/types";
import {
  fetchRemoteTrips,
  pushRemoteTrips,
} from "@/services/tripsSync";

type SyncStatus = "idle" | "syncing" | "synced" | "offline";

type TripsContextType = {
  trips: Trip[];
  loading: boolean;
  syncStatus: SyncStatus;
  getTrip: (id: string) => Trip | undefined;
  createTrip: (input: {
    title: string;
    originCity: string;
    originCode: string;
    startDate: string;
  }) => Trip;
  deleteTrip: (id: string) => void;
  setActiveBranch: (tripId: string, branchId: string) => void;
  addSegment: (tripId: string, branchId: string, seg: Omit<Segment, "id">) => void;
  removeSegment: (tripId: string, branchId: string, segmentId: string) => void;
  forkBranch: (
    tripId: string,
    parentBranchId: string,
    label: string,
    forkAfterSegmentId: string | null,
  ) => Branch;
  renameBranch: (tripId: string, branchId: string, label: string) => void;
  deleteBranch: (tripId: string, branchId: string) => void;
};

const TripsContext = createContext<TripsContextType | null>(null);

export function TripsProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  // True once we've finished one round-trip with the server (or definitively
  // failed). Until then we *do not* auto-push, so we can never overwrite real
  // remote state with a stale local cache before we've had a chance to read it.
  const [reconciled, setReconciled] = useState<boolean>(false);
  // Counts every user-driven mutation so the startup reconcile can detect
  // edits that happened while the remote fetch was in flight.
  const localMutationsRef = useRef<number>(0);
  // Monotonic revision so a slow PUT response can't overwrite the status of a
  // newer PUT that finished first.
  const pushRevRef = useRef<number>(0);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)hydrate whenever the signed-in user changes — wipes prior user's
  // in-memory trips immediately and re-runs the cache→server reconcile.
  useEffect(() => {
    let mounted = true;
    setTrips([]);
    setLoading(true);
    setSyncStatus("idle");
    setReconciled(false);
    pushRevRef.current = 0;
    localMutationsRef.current = 0;

    // No active user: stay in a clean, idle state and skip cache + sync.
    if (!userId) return;

    (async () => {
      await dropLegacyCache();

      // 1. Hydrate from per-user local cache for an instant render.
      const stored = await loadTrips(userId);
      if (!mounted) return;
      if (stored.length === 0) {
        const seeded = buildSeedTrips();
        setTrips(seeded);
        await saveTrips(userId, seeded);
      } else {
        setTrips(stored);
      }
      setLoading(false);

      // 2. Reconcile with the server in the background.
      const mutationsBeforeFetch = localMutationsRef.current;
      setSyncStatus("syncing");
      const remote = await fetchRemoteTrips();
      if (!mounted) return;

      if (remote === null) {
        setSyncStatus("offline");
        // Mark reconciled even on offline so subsequent edits can push
        // (best-effort) once connectivity returns. No risk of overwriting
        // remote because remote is currently unreachable anyway.
        setReconciled(true);
        return;
      }

      const userEditedDuringFetch =
        localMutationsRef.current !== mutationsBeforeFetch;

      if (remote.length > 0 && !userEditedDuringFetch) {
        // Adopt server state only if the user hasn't started editing.
        setTrips(remote);
        await saveTrips(userId, remote);
      }
      // In every other case the trips-effect below will debounce-push the
      // current local state up, which makes the server converge to the device.
      setSyncStatus("synced");
      setReconciled(true);
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  // Persist to local cache on every change, and debounce a remote push.
  useEffect(() => {
    if (loading) return;
    if (!userId) return;
    saveTrips(userId, trips).catch(() => {});
    // Don't auto-push until the initial server reconcile has completed (or
    // failed) — otherwise a slow first GET can lose to the debounced first
    // PUT and we'd silently overwrite real remote state with the stale local
    // cache. User-driven edits bypass this gate (mutations > 0) because the
    // user's intent is the new source of truth.
    if (!reconciled && localMutationsRef.current === 0) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    setSyncStatus("syncing");
    const myRev = ++pushRevRef.current;
    pushTimerRef.current = setTimeout(() => {
      pushRemoteTrips(trips).then((ok) => {
        // Drop out-of-order responses so the badge always reflects the most
        // recent push attempt, not an older one that finished late.
        if (myRev !== pushRevRef.current) return;
        setSyncStatus(ok ? "synced" : "offline");
      });
    }, 600);
    return () => {
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    };
  }, [trips, loading, userId, reconciled]);

  const persist = useCallback((updater: (prev: Trip[]) => Trip[]) => {
    setTrips((prev) => {
      const next = updater(prev);
      localMutationsRef.current += 1;
      return next;
    });
  }, []);

  const getTrip = useCallback(
    (id: string) => trips.find((t) => t.id === id),
    [trips],
  );

  const createTrip = useCallback<TripsContextType["createTrip"]>((input) => {
    const branchId = genId();
    const trip: Trip = {
      id: genId(),
      title: input.title,
      originCity: input.originCity,
      originCode: input.originCode,
      startDate: input.startDate,
      activeBranchId: branchId,
      createdAt: new Date().toISOString(),
      branches: [
        {
          id: branchId,
          label: "Main plan",
          parentId: null,
          forkAfterSegmentId: null,
          color: branchPalette[0],
          segments: [],
          createdAt: new Date().toISOString(),
        },
      ],
    };
    persist((prev) => [trip, ...prev]);
    return trip;
  }, [persist]);

  const deleteTrip = useCallback((id: string) => {
    persist((prev) => prev.filter((t) => t.id !== id));
  }, [persist]);

  const setActiveBranch = useCallback((tripId: string, branchId: string) => {
    persist((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, activeBranchId: branchId } : t)),
    );
  }, [persist]);

  const addSegment = useCallback<TripsContextType["addSegment"]>(
    (tripId, branchId, seg) => {
      const newSeg: Segment = { ...seg, id: genId() };
      persist((prev) =>
        prev.map((t) =>
          t.id !== tripId
            ? t
            : {
                ...t,
                branches: t.branches.map((b) =>
                  b.id !== branchId
                    ? b
                    : {
                        ...b,
                        segments: [...b.segments, newSeg].sort(
                          (a, c) =>
                            new Date(a.depart).getTime() -
                            new Date(c.depart).getTime(),
                        ),
                      },
                ),
              },
        ),
      );
    },
    [persist],
  );

  const removeSegment = useCallback(
    (tripId: string, branchId: string, segmentId: string) => {
      persist((prev) =>
        prev.map((t) =>
          t.id !== tripId
            ? t
            : {
                ...t,
                branches: t.branches.map((b) =>
                  b.id !== branchId
                    ? b
                    : {
                        ...b,
                        segments: b.segments.filter((s) => s.id !== segmentId),
                      },
                ),
              },
        ),
      );
    },
    [persist],
  );

  const forkBranch = useCallback<TripsContextType["forkBranch"]>(
    (tripId, parentBranchId, label, forkAfterSegmentId) => {
      const trip = trips.find((t) => t.id === tripId);
      const parent = trip?.branches.find((b) => b.id === parentBranchId);
      const usedColors = new Set(trip?.branches.map((b) => b.color) ?? []);
      const color =
        branchPalette.find((c) => !usedColors.has(c)) ??
        branchPalette[(trip?.branches.length ?? 0) % branchPalette.length];

      const inheritedSegments = parent
        ? forkAfterSegmentId
          ? parent.segments.slice(
              0,
              parent.segments.findIndex((s) => s.id === forkAfterSegmentId) + 1,
            )
          : []
        : [];

      const newBranch: Branch = {
        id: genId(),
        label,
        parentId: parentBranchId,
        forkAfterSegmentId,
        color,
        createdAt: new Date().toISOString(),
        segments: inheritedSegments.map((s) => ({ ...s, id: genId() })),
      };
      persist((prev) =>
        prev.map((t) =>
          t.id !== tripId
            ? t
            : {
                ...t,
                branches: [...t.branches, newBranch],
                activeBranchId: newBranch.id,
              },
        ),
      );
      return newBranch;
    },
    [persist, trips],
  );

  const renameBranch = useCallback(
    (tripId: string, branchId: string, label: string) => {
      persist((prev) =>
        prev.map((t) =>
          t.id !== tripId
            ? t
            : {
                ...t,
                branches: t.branches.map((b) =>
                  b.id !== branchId ? b : { ...b, label },
                ),
              },
        ),
      );
    },
    [persist],
  );

  const deleteBranch = useCallback(
    (tripId: string, branchId: string) => {
      persist((prev) =>
        prev.map((t) => {
          if (t.id !== tripId) return t;
          const remaining = t.branches.filter(
            (b) => b.id !== branchId && b.parentId !== branchId,
          );
          if (remaining.length === 0) return t;
          return {
            ...t,
            branches: remaining,
            activeBranchId:
              t.activeBranchId === branchId ? remaining[0].id : t.activeBranchId,
          };
        }),
      );
    },
    [persist],
  );

  const value = useMemo<TripsContextType>(
    () => ({
      trips,
      loading,
      syncStatus,
      getTrip,
      createTrip,
      deleteTrip,
      setActiveBranch,
      addSegment,
      removeSegment,
      forkBranch,
      renameBranch,
      deleteBranch,
    }),
    [
      trips,
      loading,
      syncStatus,
      getTrip,
      createTrip,
      deleteTrip,
      setActiveBranch,
      addSegment,
      removeSegment,
      forkBranch,
      renameBranch,
      deleteBranch,
    ],
  );

  return (
    <TripsContext.Provider value={value}>{children}</TripsContext.Provider>
  );
}

export function useTrips() {
  const ctx = useContext(TripsContext);
  if (!ctx) throw new Error("useTrips must be used within TripsProvider");
  return ctx;
}
