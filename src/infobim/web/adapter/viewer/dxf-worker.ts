/// <reference lib="webworker" />
import { DxfViewer } from 'dxf-viewer';

// dxf-viewer parses the file and prepares its geometry here, off the UI thread.
DxfViewer.SetupWorker();
