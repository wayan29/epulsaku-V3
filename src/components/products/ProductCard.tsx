// src/components/products/ProductCard.tsx
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Tag, Bookmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProductCardProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  imageUrl?: string;
  href?: string;
  onClick?: () => void;
  productCount?: number; // Added to display product count
  isSelected?: boolean;
}

export default function ProductCard({
  title,
  description,
  icon: IconComponent,
  imageUrl,
  href,
  onClick,
  productCount,
  isSelected,
}: ProductCardProps) {
  const cardBaseClasses = `group relative text-center shadow-md hover:shadow-xl transition-all duration-300 h-[180px] flex flex-col items-center justify-center p-4`;
  const selectedClasses = isSelected ? 'ring-2 ring-primary border-primary' : 'border-border';
  const cursorClass = onClick || href ? 'cursor-pointer' : 'cursor-default';

  const IconDisplay = IconComponent || Tag;

  const cardContent = (
    <Card className={`${cardBaseClasses} ${selectedClasses} ${cursorClass}`}>
      {productCount !== undefined && (
         <Badge variant="default" className="absolute top-2 right-2 flex items-center gap-1">
            <Bookmark className="h-3 w-3" />
            {productCount}
         </Badge>
      )}

      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-lg bg-background shadow-inner">
        {imageUrl ? (
          <div className="relative h-10 w-10">
            <Image
              src={imageUrl}
              alt={title}
              fill
              className="object-contain"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
        ) : (
          <IconDisplay className="h-8 w-8 text-primary transition-transform group-hover:scale-110" />
        )}
      </div>

      <CardTitle className="text-md font-semibold leading-tight">{title}</CardTitle>
      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {cardContent}
      </Link>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className="block h-full">
        {cardContent}
      </div>
    );
  }

  return <div className="block h-full">{cardContent}</div>;
}