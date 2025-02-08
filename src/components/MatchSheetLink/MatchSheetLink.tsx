import { FilePdfOutlined } from '@ant-design/icons';

import { Competition, Match } from '@/model/model';

import './MatchSheetLink.scss';

interface MatchSheetLinkProps {
  competition: Competition;
  match: Match;
}

const MatchSheetLink = ({ competition, match }: MatchSheetLinkProps) => {
  return (
    match.winner && (
      <a
        href={`https://www.ffvbbeach.org/ffvbapp/resu/ffvolley_fdme.php?saison=${competition.season}&codent=ACJEUNES&codmatch=${match.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="vb-match-sheet-link"
      >
        <FilePdfOutlined />
      </a>
    )
  );
};

export default MatchSheetLink;
