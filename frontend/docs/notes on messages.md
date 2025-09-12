export interface Message {
	t: string;
	d?: string;
	l?: number[];
}



master sends like this
{"t":"g","d":"{\"b\":[-0.58,-13.192],\"pd\":[[0,9.15],[0,-9.15]]}"}