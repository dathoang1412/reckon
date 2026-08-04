import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import type { DictionaryInfo } from "../../../preload/index";

export default function DictionaryPanel({ dictionary }: { dictionary: DictionaryInfo }) {
  return (
    <>
      <Divider sx={{ margin: "10px 0" }} />
      {dictionary.phonetic && (
        <Typography color="text.secondary" sx={{ display: "block", marginBottom: "6px" }}>
          /{dictionary.phonetic}/
          {dictionary.audioUrl && (
            <IconButton size="small" onClick={() => new Audio(dictionary.audioUrl).play()}>
              <VolumeUpIcon fontSize="small" />
            </IconButton>
          )}
        </Typography>
      )}
      <Stack spacing={0.75} sx={{ width: "100%" }}>
        {dictionary.definitions.map((d, i) => (
          <div key={i}>
            <Chip label={d.partOfSpeech} size="small" variant="outlined" />
            <Typography sx={{ display: "block", marginTop: "2px" }}>{d.definition}</Typography>
            {d.example && (
              <Typography color="text.secondary" sx={{ display: "block", fontStyle: "italic" }}>
                “{d.example}”
              </Typography>
            )}
          </div>
        ))}
      </Stack>
    </>
  );
}
