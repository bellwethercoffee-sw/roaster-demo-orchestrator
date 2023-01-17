export const decodeToken = (encodedText: string): any => {
    try {
        return JSON.parse(Buffer.from(encodedText.split('.')[1], 'base64').toString());
    } catch (error) {
        return null;
    }
};
