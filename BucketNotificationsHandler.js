exports.handler = (event, context) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
    const s3 = new (require('aws-sdk').S3)();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require('https');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const url = require('url');
    log(JSON.stringify(event, undefined, 2));
    const props = event.ResourceProperties;
    if (event.RequestType === 'Delete') {
        props.NotificationConfiguration = {}; // this is how you clean out notifications
    }
    const req = {
        Bucket: props.BucketName,
        NotificationConfiguration: props.NotificationConfiguration,
    };
    return s3.putBucketNotificationConfiguration(req, (err, data) => {
        log({ err, data });
        if (err) {
            return submitResponse('FAILED', err.message + `\nMore information in CloudWatch Log Stream: ${context.logStreamName}`);
        }
        else {
            return submitResponse('SUCCESS');
        }
    });
    function log(obj) {
        console.error(event.RequestId, event.StackId, event.LogicalResourceId, obj);
    }
    // eslint-disable-next-line max-len
    // adapted from https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-lambda-function-code.html#cfn-lambda-function-code-cfnresponsemodule
    // to allow sending an error messge as a reason.
    function submitResponse(responseStatus, reason) {
        const responseBody = JSON.stringify({
            Status: responseStatus,
            Reason: reason || 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
            PhysicalResourceId: event.PhysicalResourceId || event.LogicalResourceId,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            NoEcho: false,
        });
        log({ responseBody });
        const parsedUrl = url.parse(event.ResponseURL);
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.path,
            method: 'PUT',
            headers: {
                'content-type': '',
                'content-length': responseBody.length,
            },
        };
        const request = https.request(options, (r) => {
            log({ statusCode: r.statusCode, statusMessage: r.statusMessage });
            context.done();
        });
        request.on('error', (error) => {
            log({ sendError: error });
            context.done();
        });
        request.write(responseBody);
        request.end();
    }
};