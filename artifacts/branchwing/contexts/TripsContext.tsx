import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { branchPalette } from "@/constants/colors";
import { loadTrips, saveTrips } from "@/lib/storage";
import { buildSeedTrips } from "@/lib/seed";
import { genId } from "@/lib/time";
import type { Branch, Segment, Trip } from "@/lib/types";

type TripsContextType = {
  trips: Trip[];
  loading: boolean;
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

export function TripsProvider({ children }: { children: React.ReactNode }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadTrips();
      if (!mounted) return;
      if (stored.length === 0) {
        const seeded = buildSeedTrips();
        setTrips(seeded);
        await saveTrips(seeded);
      } else {
        setTrips(stored);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      saveTrips(trips).catch(() => {});
    }
  }, [trips, loading]);

  const persist = useCallback((updater: (prev: Trip[]) => Trip[]) => {
    setTrips((prev) => updater(prev));
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
