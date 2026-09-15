-- Spec 11: publicação manual dos Stories (link clicável só sai pelo app).
-- As entregas existentes saíram pela API e ficam automáticas.
ALTER TABLE "social_delivery"
  ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'AUTOMATICO',
  ADD COLUMN "preparedImageUrl" TEXT,
  ADD COLUMN "publishedByStaffId" TEXT;
