UPDATE "Payment"
SET "paymentStatus" = '매출취소'
WHERE "paymentStatus" = '결제취소';
