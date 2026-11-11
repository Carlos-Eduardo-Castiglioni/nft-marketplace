import { Link } from '@tanstack/react-router'

export function FeaturedNft() {
  return (
    <Link
      to="/nft/$nftId"
      params={{ nftId: 'sage-nomad-009' }}
      className="mt-6 block rounded-sm bg-surface p-3 font-mono transition-colors hover:bg-surface-2"
    >
      <p className="text-xs font-bold text-primary">NFT EM DESTAQUE</p>
      <p className="mb-2 mt-1 text-center text-[11px] font-semibold">OFERTA LIMITADA</p>
      <img src="nfts/nomad-320.webp" alt="Sage Nomad #009 em destaque" width={320} height={320} loading="lazy" className="aspect-square w-full rounded-lg object-cover" />
    </Link>
  )
}
