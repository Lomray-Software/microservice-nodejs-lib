/**
 * Just delay execute on provided seconds
 */
const WaitSec = (seconds: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });

export default WaitSec;
