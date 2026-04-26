export type Segment = {
  id: string;
  fromCode: string;
  fromCity: string;
  toCode: string;
  toCity: string;
  depart: string;
  arrive: string;
  airline: string;
  flightNo: string;
  price?: number;
};

export type Branch = {
  id: string;
  label: string;
  parentId: string | null;
  forkAfterSegmentId: string | null;
  color: string;
  segments: Segment[];
  createdAt: string;
};

export type Trip = {
  id: string;
  title: string;
  originCity: string;
  originCode: string;
  startDate: string;
  branches: Branch[];
  activeBranchId: string;
  createdAt: string;
};
