
CREATE TABLE IF NOT EXISTS public.return_requests (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  order_number TEXT NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL CHECK (
    reason IN (
      'Damaged',
      'Wrong Item',
      'Size Issue',
      'Not As Described',
      'Changed Mind'
    )
  ),
  status TEXT NOT NULL DEFAULT 'Open' CHECK (
    status IN (
      'Open',
      'In Review',
      'Approved',
      'Rejected',
      'Completed'
    )
  ),
  resolution TEXT CHECK (
    resolution IN ('Refund', 'Replacement', 'Store Credit')
  ),
  refund_amount NUMERIC(10, 2) CHECK (
    refund_amount IS NULL OR refund_amount > 0
  ),
  is_removed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.return_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL
    REFERENCES public.return_requests(id),
  note TEXT NOT NULL CHECK (LENGTH(TRIM(note)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_return_requests_status
  ON public.return_requests(status);

CREATE INDEX IF NOT EXISTS idx_return_requests_reason
  ON public.return_requests(reason);

CREATE INDEX IF NOT EXISTS idx_return_requests_order_number
  ON public.return_requests(order_number);

CREATE INDEX IF NOT EXISTS idx_return_notes_request_created
  ON public.return_notes(request_id, created_at, id);
