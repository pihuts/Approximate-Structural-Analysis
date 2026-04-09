import 'katex/dist/katex.min.css';
import { BlockMath, InlineMath } from 'react-katex';
import { Paper, Typography, Box, IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from 'react';

interface LatexBlockProps {
  latex: string;
  title?: string;
  inline?: boolean;
  copyable?: boolean;
}

export function LatexBlock({ latex, title, inline = false, copyable = false }: LatexBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(latex).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (inline) {
    return <InlineMath math={latex} />;
  }

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: '#FAFAFA',
        overflowX: 'auto',
      }}
    >
      {title && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
            {title}
          </Typography>
          {copyable && (
            <Tooltip title={copied ? 'Copied!' : 'Copy LaTeX'}>
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
      <Box sx={{ '& .katex-display': { margin: '0.5em 0' } }}>
        <BlockMath math={latex} errorColor="#C62828" />
      </Box>
    </Paper>
  );
}

interface LatexBlockListProps {
  blocks: Array<{ index: number; step_title: string; latex: string }>;
}

export function LatexBlockList({ blocks }: LatexBlockListProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No calculation blocks available.
      </Typography>
    );
  }

  return (
    <Box>
      {blocks.map((block) => (
        <LatexBlock
          key={block.index}
          latex={block.latex}
          title={block.step_title}
          copyable
        />
      ))}
    </Box>
  );
}
