export type BottleStatus = "drifting" | "returned";

export type Bottle = {
  id: number;
  author_user_key: string;
  content: string;
  status: BottleStatus;
  target_comment_count: number;
  comment_count: number;
  created_at: string;
  returned_at: string | null;
};

export type BottleComment = {
  id: number;
  bottle_id: number;
  commenter_user_key: string;
  content: string;
  created_at: string;
};

export type BottleVisit = {
  id: number;
  bottle_id: number;
  visitor_user_key: string;
  action: "viewed" | "commented";
  visited_at: string;
  bottle_content: string;
};
